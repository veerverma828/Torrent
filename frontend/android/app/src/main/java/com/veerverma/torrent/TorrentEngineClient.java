package com.veerverma.torrent;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.IBinder;
import android.os.RemoteException;

import java.io.File;
import java.io.IOException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Main-process handle to the isolated torrent engine (see
 * TorrentEngineService, running in the ":torrent" process). Binds to the
 * service, drives a blocking start() the same shape the old in-process
 * TorrentEngine had, and — critically — treats the service dying
 * (onServiceDisconnected, fired when the isolated process is killed by a
 * native crash) as a normal recoverable error instead of taking the whole
 * app down with it.
 */
public class TorrentEngineClient {

    public interface StatusCallback {
        void onStage(String stage);
        void onStatus(int peers, long downloadRateBps, float progress);
        void onError(String message);
    }

    /** Mirrors TorrentEngine.FileHandle, plus the piece math TorrentDataSource
     *  needs done locally (no per-read IPC round trip just for arithmetic). */
    public static class FileHandle {
        public final File file;
        public final long size;
        public final long fileOffset;
        public final int pieceLength;

        FileHandle(File file, long size, long fileOffset, int pieceLength) {
            this.file = file;
            this.size = size;
            this.fileOffset = fileOffset;
            this.pieceLength = pieceLength;
        }
    }

    private final Context context;
    private final StatusCallback callback;
    private volatile ITorrentEngineService service;
    private volatile boolean serviceCrashed = false;
    private volatile boolean stopped = false;

    public TorrentEngineClient(Context context, StatusCallback callback) {
        this.context = context.getApplicationContext();
        this.callback = callback;
    }

    private final ServiceConnection connection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder binder) {
            service = ITorrentEngineService.Stub.asInterface(binder);
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            // The isolated process died — almost certainly a native crash in
            // libtorrent4j that no Java handler could catch. This is exactly
            // the scenario process isolation exists for: the main app and
            // player survive; we just surface it as a stream error.
            AppLogger.error("TorrentEngineClient", "Torrent engine process died unexpectedly (native crash)");
            service = null;
            if (!stopped) {
                serviceCrashed = true;
                callback.onError("The torrent engine crashed. This can happen with certain files — try a different stream or use a debrid key.");
            }
        }
    };

    /** Blocking: binds to the service and drives a full start(). Call off the
     *  main thread. Throws if setup fails or times out. */
    public FileHandle start(String magnet) throws Exception {
        Intent intent = new Intent(context, TorrentEngineService.class);
        boolean bound = context.bindService(intent, connection, Context.BIND_AUTO_CREATE);
        if (!bound) throw new IOException("Could not bind torrent engine service");

        // Wait for the binder connection (near-instant once the process is
        // up; only slow the very first time the :torrent process spawns).
        long deadline = System.currentTimeMillis() + 15000;
        while (service == null && !stopped && !serviceCrashed) {
            if (System.currentTimeMillis() > deadline) throw new IOException("Timed out connecting to torrent engine");
            Thread.sleep(50);
        }
        if (stopped) throw new IOException("stopped");
        if (serviceCrashed) throw new IOException("Torrent engine crashed before starting");

        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<FileHandle> result = new AtomicReference<>();
        AtomicReference<String> error = new AtomicReference<>();

        service.startTorrent(magnet, new ITorrentCallback.Stub() {
            @Override
            public void onStage(String stage) {
                callback.onStage(stage);
            }

            @Override
            public void onStatus(int peers, long downloadRate, float progress) {
                callback.onStatus(peers, downloadRate, progress);
            }

            @Override
            public void onReady(String filePath, long fileSize, long fileOffset, int pieceLength) {
                result.set(new FileHandle(new File(filePath), fileSize, fileOffset, pieceLength));
                latch.countDown();
            }

            @Override
            public void onError(String message) {
                error.set(message);
                latch.countDown();
            }
        });

        // No timeout here beyond the service's own bounded setup phase
        // (TorrentEngine's SETUP_TIMEOUT_MS) — this just waits for whichever
        // callback that produces.
        latch.await(90, TimeUnit.SECONDS);

        if (stopped) throw new IOException("stopped");
        if (error.get() != null) throw new IOException(error.get());
        FileHandle fh = result.get();
        if (fh == null) throw new IOException("Torrent engine timed out");
        return fh;
    }

    /** Non-blocking piece check — TorrentDataSource polls this while reading. */
    public boolean havePiece(int piece) {
        ITorrentEngineService s = service;
        if (s == null) return false;
        try {
            return s.havePiece(piece);
        } catch (RemoteException e) {
            return false;
        }
    }

    public void requestPieces(int startPiece, int count) {
        ITorrentEngineService s = service;
        if (s == null) return;
        try {
            s.requestPieces(startPiece, count);
        } catch (RemoteException ignored) {
        }
    }

    public boolean isStopped() {
        return stopped || serviceCrashed;
    }

    public void stop() {
        stopped = true;
        ITorrentEngineService s = service;
        try {
            if (s != null) s.stopTorrent();
        } catch (RemoteException ignored) {
        }
        try {
            context.unbindService(connection);
        } catch (IllegalArgumentException ignored) {
            // not bound — fine
        }
        service = null;
    }
}
