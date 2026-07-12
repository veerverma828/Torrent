package com.veerverma.torrent;

import android.app.Service;
import android.content.Intent;
import android.os.IBinder;
import android.os.RemoteException;

/**
 * Hosts the actual libtorrent4j engine in an isolated process (see
 * android:process=":torrent" in AndroidManifest.xml). All of the risky
 * native (JNI/C++) work happens here — if libtorrent4j hard-crashes with a
 * native signal (which no Java try/catch, including AppLogger's uncaught
 * exception handler, can intercept), only THIS process dies. The main app
 * process detects that via TorrentEngineClient's onServiceDisconnected and
 * surfaces it as a normal recoverable error instead of the whole app
 * vanishing.
 */
public class TorrentEngineService extends Service {

    private TorrentEngine engine;
    private ITorrentCallback callback;

    @Override
    public void onCreate() {
        super.onCreate();
        // Separate process = separate crash handler installation. Won't help
        // against a native signal, but any Java-level exception here still
        // gets persisted to the same shared log file.
        AppLogger.install(getApplicationContext());
        AppLogger.info("TorrentEngineService", "Service created in process " + android.os.Process.myPid());
    }

    private final ITorrentEngineService.Stub binder = new ITorrentEngineService.Stub() {
        @Override
        public void warmUp() {
            TorrentEngine.warmUp();
        }

        @Override
        public void startTorrent(String magnet, ITorrentCallback cb) {
            callback = cb;
            if (engine != null) engine.stop();

            engine = new TorrentEngine(getApplicationContext(), new TorrentEngine.StatusCallback() {
                @Override
                public void onStage(String stage) {
                    safeCallback(c -> c.onStage(stage));
                }

                @Override
                public void onStatus(int peers, long rate, float progress) {
                    safeCallback(c -> c.onStatus(peers, rate, progress));
                }

                @Override
                public void onError(String message) {
                    safeCallback(c -> c.onError(message));
                }
            });

            // Runs on the binder thread pool (this is a remote/cross-process
            // call, so it's already off the caller's main thread) — blocking
            // here is fine, same as the old in-process design.
            try {
                TorrentEngine.FileHandle fh = engine.start(magnet);
                safeCallback(c -> c.onReady(
                        fh.file.getAbsolutePath(), fh.size, engineFileOffset(), engineePieceLength()));
            } catch (Throwable e) {
                AppLogger.error("TorrentEngineService", "startTorrent failed", e);
                String msg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
                safeCallback(c -> c.onError(msg));
            }
        }

        @Override
        public boolean havePiece(int pieceIndex) {
            return engine != null && engine.havePieceNow(pieceIndex);
        }

        @Override
        public void requestPieces(int startPiece, int count) {
            if (engine != null) engine.requestPieces(startPiece, count);
        }

        @Override
        public void stopTorrent() {
            if (engine != null) {
                engine.stop();
                engine = null;
            }
        }
    };

    private long engineFileOffset() {
        return engine != null ? engine.fileOffset() : 0;
    }

    private int engineePieceLength() {
        return engine != null ? engine.pieceLength() : 0;
    }

    private interface CallbackAction {
        void run(ITorrentCallback c) throws RemoteException;
    }

    private void safeCallback(CallbackAction action) {
        ITorrentCallback cb = callback;
        if (cb == null) return;
        try {
            action.run(cb);
        } catch (RemoteException e) {
            AppLogger.error("TorrentEngineService", "callback failed (client gone?)", e);
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }

    @Override
    public void onDestroy() {
        if (engine != null) {
            engine.stop();
            engine = null;
        }
        super.onDestroy();
    }
}
