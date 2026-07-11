package com.veerverma.torrent;

import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

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

    private static TorrentStreamServer torrentServer;

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

        // Resolve the magnet to a local stream URL on a background thread, then
        // launch the same PlayerActivity as debrid playback.
        stopTorrent(); // tear down any previous torrent first
        new Thread(() -> {
            try {
                torrentServer = new TorrentStreamServer(getContext(), new TorrentStreamServer.StatusCallback() {
                    @Override
                    public void onStatus(int peers, long rate, float progress, boolean ready) {
                        JSObject data = new JSObject();
                        data.put("peers", peers);
                        data.put("downloadRate", rate);
                        data.put("progress", progress);
                        emit("torrentStatus", data);
                    }

                    @Override
                    public void onError(String message) {
                        JSObject data = new JSObject();
                        data.put("message", message);
                        emit("error", data);
                    }
                });

                String url = torrentServer.start(magnet);

                Intent intent = new Intent(getContext(), PlayerActivity.class);
                intent.putExtra(PlayerActivity.EXTRA_URL, url);
                intent.putExtra(PlayerActivity.EXTRA_TITLE, title);
                intent.putExtra(PlayerActivity.EXTRA_SUBTITLE, subtitle);
                intent.putExtra(PlayerActivity.EXTRA_START_PERCENT, startPercent);
                intent.putExtra(PlayerActivity.EXTRA_METADATA, metadataJson);
                intent.putExtra(PlayerActivity.EXTRA_HAS_NEXT, hasNext);
                intent.putExtra(PlayerActivity.EXTRA_IS_TORRENT, true);
                intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            } catch (Exception e) {
                JSObject data = new JSObject();
                data.put("message", e.getMessage() != null ? e.getMessage() : "Torrent failed to start");
                emit("error", data);
                stopTorrent();
            }
        }).start();

        call.resolve();
    }

    /** Called by PlayerActivity when a torrent-backed player closes. */
    static void stopTorrent() {
        TorrentStreamServer s = torrentServer;
        if (s != null) {
            s.stop();
            torrentServer = null;
        }
    }
}
