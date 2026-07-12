package com.veerverma.torrent;

import android.content.Context;
import android.util.Log;

import org.libtorrent4j.AlertListener;
import org.libtorrent4j.Priority;
import org.libtorrent4j.SessionManager;
import org.libtorrent4j.TorrentHandle;
import org.libtorrent4j.TorrentInfo;
import org.libtorrent4j.TorrentStatus;
import org.libtorrent4j.alerts.AddTorrentAlert;
import org.libtorrent4j.alerts.Alert;
import org.libtorrent4j.alerts.AlertType;
import org.libtorrent4j.alerts.PieceFinishedAlert;

import java.io.File;
import java.io.IOException;

/**
 * On-device torrent streaming without a debrid service.
 *
 * Downloads the selected video file's pieces (largest file in the torrent)
 * with a moving read-ahead window, and exposes the growing file directly to
 * a custom ExoPlayer DataSource ({@link TorrentDataSource}) — no local HTTP
 * server. That mirrors how TorrentStream-Android hands data to a player: a
 * blocking piece-wait gatekeeping direct file reads, woken by real
 * PIECE_FINISHED alerts, with no artificial timeout once the file is
 * playing (a slow piece just makes the read wait longer — it never kills
 * the stream the way our previous HTTP-based version did).
 *
 * Files live in the app cache and are deleted when the stream stops (temp
 * cache, auto-clear).
 */
public class TorrentEngine {

    public interface StatusCallback {
        void onStage(String stage);
        void onStatus(int peers, long downloadRateBps, float progress);
        void onError(String message);
    }

    private static final String TAG = "TorrentEngine";
    private static final int READAHEAD_PIECES = 12;
    // Timeouts only guard the one-time setup (metadata + first pieces) so a
    // dead torrent doesn't hang forever with no feedback. Once the file
    // handle is playing, waitForPiece has no timeout — mirrors
    // TorrentStream-Android, which blocks indefinitely once created.
    private static final int SETUP_TIMEOUT_MS = 60000;

    // The BitTorrent session (and its DHT routing table) is process-wide and
    // long-lived, NOT per-stream. Recreating it on every tap forced DHT to
    // cold-bootstrap from zero each time. Real torrent clients keep one
    // session running for the app's lifetime for exactly this reason.
    private static final SessionManager sharedSession = new SessionManager();
    private static volatile TorrentEngine activeInstance;
    private static final Object pieceLock = new Object();

    static {
        sharedSession.addListener(new AlertListener() {
            @Override
            public int[] types() {
                return new int[]{AlertType.ADD_TORRENT.swig(), AlertType.PIECE_FINISHED.swig()};
            }

            @Override
            public void alert(Alert<?> alert) {
                TorrentEngine instance = activeInstance;
                if (instance == null) return;
                try {
                    if (alert.type() == AlertType.ADD_TORRENT) {
                        instance.handle = ((AddTorrentAlert) alert).handle();
                        instance.handle.resume();
                    } else if (alert.type() == AlertType.PIECE_FINISHED) {
                        synchronized (pieceLock) {
                            pieceLock.notifyAll();
                        }
                    }
                } catch (Throwable t) {
                    AppLogger.error(TAG, "alert error", t);
                }
            }
        });
    }

    /** Start the shared session eagerly (e.g. at app launch) so DHT has a
     *  head start bootstrapping before the user ever taps Stream. Safe to
     *  call repeatedly — libtorrent4j no-ops if already running. */
    static void warmUp() {
        if (!sharedSession.isRunning()) sharedSession.start();
    }

    private final Context context;
    private final StatusCallback callback;

    volatile TorrentHandle handle;
    private volatile TorrentInfo torrentInfo;
    private int fileIndex = -1;
    private long fileOffset;
    private long fileSize;
    private int pieceLength;
    private File dataFile;
    private File saveDir;

    private volatile boolean stopped = false;

    public TorrentEngine(Context context, StatusCallback callback) {
        this.context = context.getApplicationContext();
        this.callback = callback;
    }

    /** Handle to the resolved file, given to {@link TorrentDataSource}. */
    public static class FileHandle {
        public final File file;
        public final long size;

        FileHandle(File file, long size) {
            this.file = file;
            this.size = size;
        }
    }

    /** Blocking: adds the magnet, waits for metadata + first bytes. Call off
     *  the main thread. Returns a handle once enough data exists to start
     *  playback. */
    public FileHandle start(String magnet) throws Exception {
        AppLogger.info(TAG, "start() magnet=" + magnet.substring(0, Math.min(80, magnet.length())));
        saveDir = new File(context.getCacheDir(), "torrents");
        if (saveDir.exists()) deleteRecursive(saveDir);
        saveDir.mkdirs();

        activeInstance = this;
        warmUp();

        callback.onStage("Looking up torrent metadata…");
        byte[] data = sharedSession.fetchMagnet(magnet, 60, saveDir);
        if (stopped) throw new IOException("stopped");
        if (data == null) {
            throw new IOException(
                    "No peers found for this torrent within 60s. It may have no seeders, " +
                    "or your network may be blocking P2P traffic (DHT/tracker UDP) — try a " +
                    "different network or use a debrid key instead.");
        }

        torrentInfo = TorrentInfo.bdecode(data);
        sharedSession.download(torrentInfo, saveDir);

        callback.onStage("Connecting to torrent swarm…");
        long deadline = System.currentTimeMillis() + SETUP_TIMEOUT_MS;
        while (!stopped && (handle == null || !handle.isValid())) {
            if (System.currentTimeMillis() > deadline) throw new IOException("Timed out adding torrent");
            Thread.sleep(100);
        }
        if (stopped) throw new IOException("stopped");

        pickLargestVideoFile();

        // Download only the selected file, sequentially, top priority.
        int numFiles = torrentInfo.numFiles();
        Priority[] priorities = new Priority[numFiles];
        for (int i = 0; i < numFiles; i++) priorities[i] = Priority.IGNORE;
        priorities[fileIndex] = Priority.TOP_PRIORITY;
        handle.prioritizeFiles(priorities);

        dataFile = new File(saveDir, torrentInfo.files().filePath(fileIndex));

        // Prime the first pieces so playback can start quickly. This is the
        // only other bounded wait — after this, TorrentDataSource's reads
        // block without a timeout (matching TorrentStream-Android).
        callback.onStage("Buffering first pieces…");
        int firstPiece = pieceForFileOffset(0);
        requestPieces(firstPiece, READAHEAD_PIECES);
        waitForPieceBounded(firstPiece, SETUP_TIMEOUT_MS);

        startStatusThread();
        AppLogger.info(TAG, "start() ready, file=" + dataFile + " size=" + fileSize);
        return new FileHandle(dataFile, fileSize);
    }

    private void pickLargestVideoFile() {
        int best = 0;
        long bestSize = -1;
        int n = torrentInfo.numFiles();
        for (int i = 0; i < n; i++) {
            long size = torrentInfo.files().fileSize(i);
            if (size > bestSize) {
                bestSize = size;
                best = i;
            }
        }
        fileIndex = best;
        fileOffset = torrentInfo.files().fileOffset(fileIndex);
        fileSize = torrentInfo.files().fileSize(fileIndex);
        pieceLength = torrentInfo.pieceLength();
    }

    int pieceForFileOffset(long fileByte) {
        return (int) ((fileOffset + fileByte) / pieceLength);
    }

    long pieceEndByteForFile(int piece) {
        return ((long) (piece + 1) * pieceLength) - fileOffset - 1;
    }

    int pieceLength() {
        return pieceLength;
    }

    long fileOffset() {
        return fileOffset;
    }

    void requestPieces(int startPiece, int count) {
        int last = Math.min(torrentInfo.numPieces() - 1, startPiece + count);
        for (int p = startPiece; p <= last; p++) {
            handle.piecePriority(p, Priority.TOP_PRIORITY);
            handle.setPieceDeadline(p, (p - startPiece) * 100);
        }
    }

    /** Used only during initial setup, where a hard failure is appropriate if
     *  the swarm never delivers. */
    private void waitForPieceBounded(int piece, long timeoutMs) throws IOException {
        long deadline = System.currentTimeMillis() + timeoutMs;
        synchronized (pieceLock) {
            while (!stopped && !handle.havePiece(piece)) {
                if (System.currentTimeMillis() > deadline) throw new IOException("Timed out waiting for data");
                handle.setPieceDeadline(piece, 0);
                try {
                    pieceLock.wait(1000);
                } catch (InterruptedException ignored) {
                }
            }
        }
        if (stopped) throw new IOException("stopped");
    }

    /** Used by {@link TorrentDataSource} during playback: blocks until the
     *  piece is available or the stream is stopped — no timeout. A slow
     *  piece just makes the read wait longer instead of killing playback,
     *  matching TorrentStream-Android's design. */
    void waitForPiece(int piece) throws IOException {
        synchronized (pieceLock) {
            while (!stopped && !handle.havePiece(piece)) {
                handle.setPieceDeadline(piece, 0);
                try {
                    pieceLock.wait(1000);
                } catch (InterruptedException ignored) {
                }
            }
        }
        if (stopped) throw new IOException("stopped");
    }

    boolean isStopped() {
        return stopped;
    }

    /** Non-blocking piece check, for TorrentEngineService to expose over IPC
     *  (the isolated-process client polls this instead of blocking in-process
     *  now that the engine and its data source live in different processes). */
    public boolean havePieceNow(int piece) {
        return handle != null && handle.isValid() && handle.havePiece(piece);
    }

    private void startStatusThread() {
        Thread t = new Thread(() -> {
            while (!stopped && handle != null && handle.isValid()) {
                try {
                    TorrentStatus st = handle.status();
                    callback.onStatus(st.numPeers(), (long) st.downloadRate(), st.progress());
                } catch (Throwable ignored) {
                }
                try {
                    Thread.sleep(1000);
                } catch (InterruptedException ignored) {
                }
            }
        });
        t.setDaemon(true);
        t.start();
    }

    public void stop() {
        stopped = true;
        if (activeInstance == this) activeInstance = null;
        synchronized (pieceLock) {
            pieceLock.notifyAll(); // release any TorrentDataSource blocked in waitForPiece
        }
        try {
            if (handle != null && handle.isValid()) sharedSession.remove(handle);
        } catch (Throwable ignored) {
        }
        try {
            if (saveDir != null) deleteRecursive(saveDir);
        } catch (Throwable ignored) {
        }
    }

    private static void deleteRecursive(File f) {
        if (f.isDirectory()) {
            File[] kids = f.listFiles();
            if (kids != null) for (File k : kids) deleteRecursive(k);
        }
        //noinspection ResultOfMethodCallIgnored
        f.delete();
    }
}
