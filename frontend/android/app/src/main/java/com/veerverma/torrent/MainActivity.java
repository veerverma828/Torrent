package com.veerverma.torrent;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // Custom plugins living in this app module aren't picked up by cap sync's
    // npm-plugin auto-discovery -- they must be registered explicitly here,
    // or JS calls fail with "plugin is not implemented on android".
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ApkUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
