package com.veerverma.torrent;

import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.atomic.AtomicLong;

/**
 * Bridges the React app to a native media3/ExoPlayer screen (PlayerActivity).
 *
 * The plugin is a pure launcher + event relay: JS resolves the debrid direct
 * URL (Real-Debrid/Torbox) and hands it here ready to play; all playback,
 * track selection, gestures, PiP and Cast happen natively so the app can
 * decode MKV/HEVC/AC3/DTS/10-bit that the WebView's HTML5 <video> cannot.
 *
 * PlayerActivity pushes lifecycle/position events back through the static
 * {@link #emit} hook, which forwards them to JS listeners (see
 * frontend/src/lib/nativePlayer.js). Progress is echoed with the opaque
 * metadataJson the caller supplied so JS can attribute it to the right title.
 */
@CapacitorPlugin(name = "NativePlayer")
public class NativePlayerPlugin extends Plugin {

    private static NativePlayerPlugin instance;

    @Override
    public void load() {
        instance = this;
        // Start the BitTorrent session (DHT bootstrap) as soon as the app
        // opens, not on the first Stream tap — gives peer discovery a head
        // start of however long the user spends browsing before playing.
        new Thread(TorrentEngine::warmUp).start();
    }

    /** Called from PlayerActivity (any thread) to forward an event to JS. */
    static void emit(String event, JSObject data) {
        NativePlayerPlugin p = instance;
        if (p != null) {
            p.notifyListeners(event, data, true);
        }
    }

    @PluginMethod
    public void play(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("Missing url");
            return;
        }

        Intent intent = new Intent(getContext(), PlayerActivity.class);
        intent.putExtra(PlayerActivity.EXTRA_URL, url);
        intent.putExtra(PlayerActivity.EXTRA_TITLE, call.getString("title", ""));
        intent.putExtra(PlayerActivity.EXTRA_SUBTITLE, call.getString("subtitle", ""));
        intent.putExtra(PlayerActivity.EXTRA_START_MS, call.getLong("startPositionMs", 0L));
        intent.putExtra(PlayerActivity.EXTRA_START_PERCENT, call.getDouble("startPercent", 0.0));
        intent.putExtra(PlayerActivity.EXTRA_METADATA, call.getString("metadataJson", "{}"));
        intent.putExtra(PlayerActivity.EXTRA_HAS_NEXT, call.getBoolean("hasNext", false));
        // singleTop: if the player is already open (auto-next), reuse it.
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        getContext().startActivity(intent);

        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        PlayerActivity.requestStop();
        call.resolve();
    }

    // ---- P2P torrent streaming (no debrid) ----

    /** Bundles the engine + resolved file so PlayerActivity can build a
     *  TorrentDataSource for this launch (can't cross an Intent as extras). */
    static class PendingTorrent {
        final TorrentEngine engine;
        final TorrentEngine.FileHandle fileHandle;

        PendingTorrent(TorrentEngine engine, TorrentEngine.FileHandle fileHandle) {
            this.engine = engine;
            this.fileHandle = fileHandle;
        }
    }

    private static volatile TorrentEngine activeEngine;
    private static volatile PendingTorrent pendingTorrent;
    // Bumped on every playTorrent call so a superseded attempt's own failure
    // (which is expected — we just cancelled it) never surfaces as an error
    // for whatever the user tapped most recently.
    private static final AtomicLong generation = new AtomicLong(0);

    /** Consumed exactly once by PlayerActivity when launching for a torrent. */
    static PendingTorrent consumePendingTorrent() {
        PendingTorrent p = pendingTorrent;
        pendingTorrent = null;
        return p;
    }

    @PluginMethod
    public void playTorrent(PluginCall call) {
        String magnet = call.getString("magnet");
        if (magnet == null || magnet.isEmpty()) {
            call.reject("Missing magnet");
            return;
        }
        final String title = call.getString("title", "");
        final String subtitle = call.getString("subtitle", "");
        final double startPercent = call.getDouble("startPercent", 0.0);
        final String metadataJson = call.getString("metadataJson", "{}");
        final boolean hasNext = call.getBoolean("hasNext", false);

        // Immediate feedback: resolving a magnet (DHT/tracker lookup) can take
        // up to a minute, and there's no PlayerActivity on screen yet to show
        // a spinner — without this the UI looks like the tap did nothing.
        JSObject resolving = new JSObject();
        resolving.put("phase", "resolving");
        emit("torrentStatus", resolving);

        stopTorrent(); // tear down any previous torrent first
        final long myGeneration = generation.incrementAndGet();

        new Thread(() -> {
            // Local variable, not the static field: two overlapping calls must
            // each drive their OWN TorrentEngine. Reading the shared static
            // field here would risk thread A calling .start() on thread B's
            // object (or a just-stopped one) once B reassigns it.
            TorrentEngine engine = new TorrentEngine(getContext(), new TorrentEngine.StatusCallback() {
                @Override
                public void onStage(String stage) {
                    if (generation.get() != myGeneration) return;
                    JSObject data = new JSObject();
                    data.put("phase", "resolving");
                    data.put("stage", stage);
                    emit("torrentStatus", data);
                }

                @Override
                public void onStatus(int peers, long rate, float progress) {
                    if (generation.get() != myGeneration) return; // superseded — stay quiet
                    JSObject data = new JSObject();
                    data.put("peers", peers);
                    data.put("downloadRate", rate);
                    data.put("progress", progress);
                    emit("torrentStatus", data);
                }

                @Override
                public void onError(String message) {
                    if (generation.get() != myGeneration) return;
                    JSObject data = new JSObject();
                    data.put("message", message);
                    emit("error", data);
                }
            });
            activeEngine = engine;

            try {
                TorrentEngine.FileHandle fileHandle = engine.start(magnet);

                if (generation.get() != myGeneration) {
                    // A newer request came in while this one was resolving —
                    // this attempt lost the race; tear it down quietly instead
                    // of launching a stale player or reporting a fake failure.
                    engine.stop();
                    return;
                }

                pendingTorrent = new PendingTorrent(engine, fileHandle);

                Intent intent = new Intent(getContext(), PlayerActivity.class);
                intent.putExtra(PlayerActivity.EXTRA_TITLE, title);
                intent.putExtra(PlayerActivity.EXTRA_SUBTITLE, subtitle);
                intent.putExtra(PlayerActivity.EXTRA_START_PERCENT, startPercent);
                intent.putExtra(PlayerActivity.EXTRA_METADATA, metadataJson);
                intent.putExtra(PlayerActivity.EXTRA_HAS_NEXT, hasNext);
                intent.putExtra(PlayerActivity.EXTRA_IS_TORRENT, true);
                intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            } catch (Throwable e) {
                // Throwable, not Exception: a native library load failure
                // (UnsatisfiedLinkError) is an Error, not an Exception, and
                // would otherwise silently die in this background thread with
                // no event ever reaching JS.
                android.util.Log.e("NativePlayerPlugin", "playTorrent failed", e);

                if (generation.get() != myGeneration) {
                    // Expected: this attempt was cancelled by a newer tap
                    // (start() throws "stopped" once cancelled). Not a real
                    // failure — don't scare the user with an error toast for
                    // an action they didn't take.
                    android.util.Log.d("NativePlayerPlugin", "Superseded attempt ended (" + e.getMessage() + ") — ignoring");
                    return;
                }

                JSObject data = new JSObject();
                String msg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
                if (e instanceof UnsatisfiedLinkError) {
                    msg = "Torrent engine failed to load on this device (" + msg + ")";
                }
                data.put("message", "Torrent failed to start: " + msg);
                emit("error", data);
                engine.stop();
                if (activeEngine == engine) activeEngine = null;
            }
        }).start();

        call.resolve();
    }

    /** Called by PlayerActivity when a torrent-backed player closes. */
    static void stopTorrent() {
        TorrentEngine e = activeEngine;
        if (e != null) {
            e.stop();
            activeEngine = null;
        }
        pendingTorrent = null;
    }
}
