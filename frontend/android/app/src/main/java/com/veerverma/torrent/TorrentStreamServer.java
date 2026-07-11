package com.veerverma.torrent;

import android.content.Context;
import android.util.Log;

import org.libtorrent4j.AlertListener;
import org.libtorrent4j.Priority;
import org.libtorrent4j.SessionManager;
import org.libtorrent4j.TorrentHandle;
import org.libtorrent4j.TorrentInfo;
import org.libtorrent4j.alerts.AddTorrentAlert;
import org.libtorrent4j.alerts.Alert;
import org.libtorrent4j.alerts.AlertType;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.util.ArrayList;
import java.util.List;

import fi.iki.elonen.NanoHTTPD;

/**
 * On-device torrent streaming without a debrid service.
 *
 * Runs a libtorrent4j session that downloads the selected video file's pieces
 * (largest file in the torrent) with a moving read-ahead window, and exposes
 * them over a loopback HTTP server so ExoPlayer can play + seek via ordinary
 * Range requests. Pieces are fetched on demand: a read blocks only until the
 * bytes it needs are present, and seeking re-prioritises around the new offset.
 *
 * Files live in the app cache and are deleted when the stream stops (temp
 * cache, auto-clear). Loopback only — never exposed off-device.
 */
public class TorrentStreamServer {

    public interface StatusCallback {
        void onStatus(int peers, long downloadRateBps, float progress, boolean ready);
        void onError(String message);
    }

    private static final String TAG = "TorrentStream";
    private static final int READAHEAD_PIECES = 12;
    private static final int PIECE_WAIT_TIMEOUT_MS = 60000;

    private final Context context;
    private final SessionManager session = new SessionManager();
    private final StatusCallback callback;

    private volatile TorrentHandle handle;
    private volatile TorrentInfo torrentInfo;
    private int fileIndex = -1;
    private long fileOffset;
    private long fileSize;
    private int pieceLength;
    private File dataFile;
    private File saveDir;

    private HttpServer httpServer;
    private volatile boolean stopped = false;

    public TorrentStreamServer(Context context, StatusCallback callback) {
        this.context = context.getApplicationContext();
        this.callback = callback;
    }

    /** Blocking: adds the magnet, waits for metadata + first bytes, returns a
     *  local stream URL. Call off the main thread. */
    public String start(String magnet) throws Exception {
        saveDir = new File(context.getCacheDir(), "torrents");
        if (saveDir.exists()) deleteRecursive(saveDir);
        saveDir.mkdirs();

        session.addListener(new AlertListener() {
            @Override
            public int[] types() {
                return new int[]{
                        AlertType.ADD_TORRENT.swig(),
                        AlertType.METADATA_RECEIVED.swig(),
                        AlertType.PIECE_FINISHED.swig(),
                        AlertType.TORRENT_ERROR.swig(),
                };
            }

            @Override
            public void alert(Alert<?> alert) {
                try {
                    if (alert.type() == AlertType.ADD_TORRENT) {
                        handle = ((AddTorrentAlert) alert).handle();
                        handle.resume();
                    }
                } catch (Throwable t) {
                    Log.e(TAG, "alert error", t);
                }
            }
        });

        session.start();
        session.download(magnet, saveDir);

        // Wait for metadata (piece map + file list).
        long deadline = System.currentTimeMillis() + PIECE_WAIT_TIMEOUT_MS;
        while (!stopped && (handle == null || !handle.isValid() || handle.torrentFile() == null)) {
            if (System.currentTimeMillis() > deadline) throw new IOException("Timed out fetching torrent metadata");
            sleep(200);
        }
        if (stopped) throw new IOException("stopped");

        torrentInfo = handle.torrentFile();
        pickLargestVideoFile();

        // Download only the selected file, sequentially, top priority.
        int numFiles = torrentInfo.numFiles();
        Priority[] priorities = new Priority[numFiles];
        for (int i = 0; i < numFiles; i++) priorities[i] = Priority.IGNORE;
        priorities[fileIndex] = Priority.TOP_PRIORITY;
        handle.prioritizeFiles(priorities);

        dataFile = new File(saveDir, torrentInfo.files().filePath(fileIndex));

        // Prime the first pieces so playback can start quickly.
        int firstPiece = pieceForFileOffset(0);
        requestPieces(firstPiece, READAHEAD_PIECES);
        waitForPiece(firstPiece);

        startStatusThread();

        httpServer = new HttpServer();
        httpServer.start(NanoHTTPD.SOCKET_READ_TIMEOUT, false);
        return "http://127.0.0.1:" + httpServer.getListeningPort() + "/stream";
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

    private int pieceForFileOffset(long fileByte) {
        return (int) ((fileOffset + fileByte) / pieceLength);
    }

    private void requestPieces(int startPiece, int count) {
        int last = Math.min(torrentInfo.numPieces() - 1, startPiece + count);
        for (int p = startPiece; p <= last; p++) {
            handle.piecePriority(p, Priority.TOP_PRIORITY);
            handle.setPieceDeadline(p, (p - startPiece) * 100);
        }
    }

    private void waitForPiece(int piece) throws IOException {
        long deadline = System.currentTimeMillis() + PIECE_WAIT_TIMEOUT_MS;
        while (!stopped && !handle.havePiece(piece)) {
            if (System.currentTimeMillis() > deadline) throw new IOException("Timed out waiting for data");
            handle.setPieceDeadline(piece, 0);
            sleep(50);
        }
        if (stopped) throw new IOException("stopped");
    }

    private void startStatusThread() {
        Thread t = new Thread(() -> {
            while (!stopped && handle != null && handle.isValid()) {
                try {
                    org.libtorrent4j.TorrentStatus st = handle.status();
                    callback.onStatus(st.numPeers(), (long) st.downloadRate(), st.progress(), true);
                } catch (Throwable ignored) {
                }
                sleep(1000);
            }
        });
        t.setDaemon(true);
        t.start();
    }

    public void stop() {
        stopped = true;
        try {
            if (httpServer != null) httpServer.stop();
        } catch (Throwable ignored) {
        }
        try {
            if (handle != null && handle.isValid()) session.remove(handle);
        } catch (Throwable ignored) {
        }
        try {
            session.stop();
        } catch (Throwable ignored) {
        }
        try {
            if (saveDir != null) deleteRecursive(saveDir);
        } catch (Throwable ignored) {
        }
    }

    // ---- local HTTP server serving the selected file with Range support ----

    private class HttpServer extends NanoHTTPD {
        HttpServer() {
            super("127.0.0.1", 0);
        }

        @Override
        public Response serve(IHTTPSession httpSession) {
            long start = 0;
            long end = fileSize - 1;
            boolean partial = false;

            String range = httpSession.getHeaders().get("range");
            if (range != null && range.startsWith("bytes=")) {
                partial = true;
                String[] parts = range.substring(6).split("-");
                try {
                    start = Long.parseLong(parts[0]);
                    if (parts.length > 1 && !parts[1].isEmpty()) end = Long.parseLong(parts[1]);
                } catch (NumberFormatException e) {
                    start = 0;
                    end = fileSize - 1;
                }
            }
            if (end >= fileSize) end = fileSize - 1;
            if (start > end) start = 0;

            long contentLength = end - start + 1;
            InputStream stream = new PieceInputStream(start, end);

            Response response = newFixedLengthResponse(
                    partial ? Response.Status.PARTIAL_CONTENT : Response.Status.OK,
                    "video/*", stream, contentLength);
            response.addHeader("Accept-Ranges", "bytes");
            if (partial) {
                response.addHeader("Content-Range", "bytes " + start + "-" + end + "/" + fileSize);
            }
            return response;
        }
    }

    /** Reads the file from disk, blocking until each needed piece is available
     *  and re-prioritising the read-ahead window as playback advances. */
    private class PieceInputStream extends InputStream {
        private long position;
        private final long end;
        private RandomAccessFile raf;

        PieceInputStream(long start, long end) {
            this.position = start;
            this.end = end;
        }

        @Override
        public int read() throws IOException {
            byte[] one = new byte[1];
            int n = read(one, 0, 1);
            return n == -1 ? -1 : (one[0] & 0xff);
        }

        @Override
        public int read(byte[] b, int off, int len) throws IOException {
            if (position > end) return -1;
            if (stopped) throw new IOException("stopped");

            int piece = pieceForFileOffset(position);
            if (!handle.havePiece(piece)) {
                requestPieces(piece, READAHEAD_PIECES);
                waitForPiece(piece);
            }

            if (raf == null) {
                waitForFile();
                raf = new RandomAccessFile(dataFile, "r");
            }

            // Don't read past the current piece boundary in one go, so we never
            // touch bytes that aren't downloaded yet.
            long pieceEndByte = ((long) (piece + 1) * pieceLength) - fileOffset - 1;
            long maxThisRead = Math.min(end, pieceEndByte) - position + 1;
            int toRead = (int) Math.min(len, maxThisRead);
            if (toRead <= 0) toRead = 1;

            raf.seek(position);
            int read = raf.read(b, off, toRead);
            if (read == -1) {
                sleep(100); // file not extended to here yet — wait for writer
                return read(b, off, len);
            }
            position += read;
            return read;
        }

        private void waitForFile() throws IOException {
            long deadline = System.currentTimeMillis() + PIECE_WAIT_TIMEOUT_MS;
            while (!stopped && (dataFile == null || !dataFile.exists())) {
                if (System.currentTimeMillis() > deadline) throw new IOException("Data file never appeared");
                sleep(100);
            }
        }

        @Override
        public void close() throws IOException {
            if (raf != null) raf.close();
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

    private static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException ignored) {
        }
    }
}
