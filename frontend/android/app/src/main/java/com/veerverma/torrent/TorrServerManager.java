package com.veerverma.torrent;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * Manages the bundled TorrServer (github.com/YouROK/TorrServer, GPLv3) binary
 * as a subprocess. This replaces the earlier libtorrent4j-based P2P engine,
 * which hit an unresolved native (JNI) crash class on Android — see multiple
 * open issues on aldenml/libtorrent4j ("crash when call SessionManager.start()
 * on Samsung devices", "Scudo ERROR: corrupted chunk header",
 * "Unable to download torrent on Android 11"). TorrServer is pure Go (no JNI)
 * and runs as a genuine separate OS process with its own memory space, so a
 * crash there can never take the app down, and Go's memory safety means this
 * whole crash class mostly doesn't exist in the first place.
 *
 * The binary ships under jniLibs/<abi>/libtorrserver.so (a naming trick: it's
 * a plain executable, not a real shared library, but naming it .so and
 * placing it under jniLibs makes Android's installer extract it to
 * getApplicationInfo().nativeLibraryDir — which is executable — avoiding the
 * W^X restriction that blocks running a file the app wrote itself elsewhere).
 *
 * See github.com/YouROK/TorrServer for source (GPLv3) — Settings shows the
 * required license notice.
 */
public class TorrServerManager {

    private static final String TAG = "TorrServerManager";
    private static final int PORT = 8090;
    private static final String BASE_URL = "http://127.0.0.1:" + PORT;
    private static final int READY_TIMEOUT_MS = 10000;
    private static final int STAT_TIMEOUT_MS = 60000;

    private static TorrServerManager instance;

    public static synchronized TorrServerManager get(Context context) {
        if (instance == null) instance = new TorrServerManager(context.getApplicationContext());
        return instance;
    }

    private final Context context;
    private Process process;
    private volatile boolean ready = false;

    private TorrServerManager(Context context) {
        this.context = context;
    }

    /** Starts the subprocess if not already running. Safe to call repeatedly
     *  (e.g. at app launch to warm it up before the first stream). */
    public synchronized void start() {
        if (process != null && isAlive()) return;

        try {
            String binPath = context.getApplicationInfo().nativeLibraryDir + "/libtorrserver.so";
            File dataDir = new File(context.getFilesDir(), "torrserver");
            dataDir.mkdirs();

            ProcessBuilder pb = new ProcessBuilder(binPath, "-p", String.valueOf(PORT), "-d", dataDir.getAbsolutePath());
            pb.redirectErrorStream(true);
            process = pb.start();
            ready = false;

            pipeOutputToLog(process.getInputStream());
            watchForDeath();

            AppLogger.info(TAG, "TorrServer subprocess started, pid-ish=" + process.hashCode());
        } catch (Throwable e) {
            AppLogger.error(TAG, "Failed to start TorrServer", e);
        }
    }

    private boolean isAlive() {
        try {
            process.exitValue();
            return false; // exitValue() didn't throw => process already exited
        } catch (IllegalThreadStateException e) {
            return true; // still running
        }
    }

    private void pipeOutputToLog(InputStream in) {
        Thread t = new Thread(() -> {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    AppLogger.info("TorrServer", line);
                }
            } catch (IOException ignored) {
                // stream closed when the process dies — expected
            }
        });
        t.setDaemon(true);
        t.start();
    }

    private void watchForDeath() {
        Thread t = new Thread(() -> {
            try {
                int code = process.waitFor();
                AppLogger.error(TAG, "TorrServer process exited unexpectedly, code=" + code);
                ready = false;
            } catch (InterruptedException ignored) {
            }
        });
        t.setDaemon(true);
        t.start();
    }

    /** Blocking: waits for the subprocess to accept connections. Call off the
     *  main thread. Throws if it never comes up within the timeout. */
    private void awaitReady() throws IOException {
        if (ready) return;
        long deadline = System.currentTimeMillis() + READY_TIMEOUT_MS;
        while (System.currentTimeMillis() < deadline) {
            try {
                HttpURLConnection conn = (HttpURLConnection) new URL(BASE_URL + "/").openConnection();
                conn.setConnectTimeout(500);
                conn.setReadTimeout(500);
                conn.getResponseCode(); // any response at all means it's up
                ready = true;
                return;
            } catch (IOException e) {
                try {
                    Thread.sleep(200);
                } catch (InterruptedException ignored) {
                }
            }
        }
        throw new IOException("TorrServer did not become ready within " + READY_TIMEOUT_MS + "ms");
    }

    /** Blocking: resolves a magnet to a playable stream URL. Call off the main
     *  thread. Picks the largest file in the torrent (mirrors the old
     *  largest-file-in-torrent heuristic). */
    public String resolveStreamUrl(String magnet) throws IOException {
        start();
        awaitReady();

        String encoded = URLEncoder.encode(magnet, "UTF-8");
        String statUrl = BASE_URL + "/stream/x?link=" + encoded + "&stat";

        JSONObject status = getJson(statUrl, STAT_TIMEOUT_MS);
        JSONArray fileStats = status.optJSONArray("file_stats");
        if (fileStats == null || fileStats.length() == 0) {
            throw new IOException("No files found in torrent");
        }

        int bestId = 1;
        long bestSize = -1;
        String bestPath = "stream";
        try {
            for (int i = 0; i < fileStats.length(); i++) {
                JSONObject f = fileStats.getJSONObject(i);
                long len = f.optLong("length", 0);
                if (len > bestSize) {
                    bestSize = len;
                    bestId = f.optInt("id", i + 1);
                    String path = f.optString("path", "stream");
                    int slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
                    bestPath = slash >= 0 ? path.substring(slash + 1) : path;
                }
            }
        } catch (Exception e) {
            throw new IOException("Malformed file_stats from TorrServer: " + e.getMessage());
        }

        return BASE_URL + "/stream/" + URLEncoder.encode(bestPath, "UTF-8")
                + "?link=" + encoded + "&index=" + bestId + "&play";
    }

    private JSONObject getJson(String url, int timeoutMs) throws IOException {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setConnectTimeout(5000);
        conn.setReadTimeout(timeoutMs);
        int code = conn.getResponseCode();
        InputStream stream = code >= 200 && code < 300 ? conn.getInputStream() : conn.getErrorStream();
        StringBuilder sb = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) sb.append(line);
        }
        if (code < 200 || code >= 300) {
            throw new IOException("TorrServer returned HTTP " + code + ": " + sb);
        }
        try {
            return new JSONObject(sb.toString());
        } catch (Exception e) {
            throw new IOException("Invalid response from TorrServer: " + e.getMessage());
        }
    }

    public void stop() {
        if (process != null) {
            process.destroy();
            process = null;
            ready = false;
        }
    }
}
