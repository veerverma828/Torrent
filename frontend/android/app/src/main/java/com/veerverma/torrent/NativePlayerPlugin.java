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
 * P2P streaming (no debrid) is handled by TorrServerManager, which resolves a
 * magnet to a plain HTTP URL (via the bundled TorrServer subprocess) and hands
 * it to the exact same play() path as debrid — see TorrServerManager.java for
 * why this replaced an earlier libtorrent4j-based engine.
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
        // Start the TorrServer subprocess as soon as the app opens, not on
        // the first Stream tap — gives it a head start (binary launch +
        // internal init) before the user ever needs it.
        new Thread(() -> TorrServerManager.get(getContext()).start()).start();
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
        launchPlayer(url, call.getString("title", ""), call.getString("subtitle", ""),
                call.getLong("startPositionMs", 0L), call.getDouble("startPercent", 0.0),
                call.getString("metadataJson", "{}"), call.getBoolean("hasNext", false));
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        PlayerActivity.requestStop();
        call.resolve();
    }

    // ---- Diagnostics: persistent crash/error log, exposed to Settings ----

    @PluginMethod
    public void getLogs(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("logs", AppLogger.readAll());
        call.resolve(ret);
    }

    @PluginMethod
    public void clearLogs(PluginCall call) {
        AppLogger.clear();
        call.resolve();
    }

    @PluginMethod
    public void logClientError(PluginCall call) {
        // Lets JS funnel window.onerror / unhandledrejection / caught API
        // errors into the same persistent file as native crashes, so a
        // Settings > Logs export has the full picture in one place.
        String tag = call.getString("tag", "JS");
        String message = call.getString("message", "");
        AppLogger.error(tag, message);
        call.resolve();
    }

    // ---- P2P torrent streaming (no debrid), via bundled TorrServer ----

    @PluginMethod
    public void playTorrent(PluginCall call) {
        String magnet = call.getString("magnet");
        if (magnet == null || magnet.isEmpty()) {
            call.reject("Missing magnet");
            return;
        }
        // Launch immediately — PlayerActivity itself now owns the resolve
        // (TorrServerManager.resolveStreamUrl call + stage callbacks) and
        // shows a branded in-player loading state the whole time, instead of
        // resolving here first and only opening the player once done. Same
        // instant-open feel as debrid.
        Intent intent = new Intent(getContext(), PlayerActivity.class);
        intent.putExtra(PlayerActivity.EXTRA_MAGNET, magnet);
        intent.putExtra(PlayerActivity.EXTRA_TITLE, call.getString("title", ""));
        intent.putExtra(PlayerActivity.EXTRA_SUBTITLE, call.getString("subtitle", ""));
        intent.putExtra(PlayerActivity.EXTRA_START_PERCENT, call.getDouble("startPercent", 0.0));
        intent.putExtra(PlayerActivity.EXTRA_METADATA, call.getString("metadataJson", "{}"));
        intent.putExtra(PlayerActivity.EXTRA_HAS_NEXT, call.getBoolean("hasNext", false));
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);

        call.resolve();
    }

    private void launchPlayer(String url, String title, String subtitle, long startPositionMs,
                               double startPercent, String metadataJson, boolean hasNext) {
        Intent intent = new Intent(getContext(), PlayerActivity.class);
        intent.putExtra(PlayerActivity.EXTRA_URL, url);
        intent.putExtra(PlayerActivity.EXTRA_TITLE, title);
        intent.putExtra(PlayerActivity.EXTRA_SUBTITLE, subtitle);
        intent.putExtra(PlayerActivity.EXTRA_START_MS, startPositionMs);
        intent.putExtra(PlayerActivity.EXTRA_START_PERCENT, startPercent);
        intent.putExtra(PlayerActivity.EXTRA_METADATA, metadataJson);
        intent.putExtra(PlayerActivity.EXTRA_HAS_NEXT, hasNext);
        // singleTop: if the player is already open (auto-next), reuse it.
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
    }
}
