package com.veerverma.torrent;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // Custom plugins living in this app module aren't picked up by cap sync's
    // npm-plugin auto-discovery -- they must be registered explicitly here,
    // or JS calls fail with "plugin is not implemented on android".
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Installed first, before any plugin/player code runs, so a crash
        // anywhere in the app gets its full stack trace written to disk
        // before the process dies — the only way to see what happened when
        // the app closes outright instead of showing a recoverable error.
        AppLogger.install(getApplicationContext());
        registerPlugin(ApkUpdaterPlugin.class);
        registerPlugin(NativePlayerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
