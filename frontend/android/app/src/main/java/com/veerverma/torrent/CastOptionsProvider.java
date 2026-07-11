package com.veerverma.torrent;

import android.content.Context;

import com.google.android.gms.cast.framework.CastOptions;
import com.google.android.gms.cast.framework.OptionsProvider;
import com.google.android.gms.cast.framework.SessionProvider;

import java.util.List;

/**
 * Required entry point for the Cast SDK (referenced by name from the
 * OPTIONS_PROVIDER_CLASS_NAME meta-data in AndroidManifest.xml). Uses the
 * Default Media Receiver so no custom Cast receiver app is needed.
 */
public class CastOptionsProvider implements OptionsProvider {

    // Google's Default Media Receiver — plays plain http(s) media URLs.
    private static final String DEFAULT_RECEIVER_APP_ID = "CC1AD845";

    @Override
    public CastOptions getCastOptions(Context context) {
        return new CastOptions.Builder()
                .setReceiverApplicationId(DEFAULT_RECEIVER_APP_ID)
                .build();
    }

    @Override
    public List<SessionProvider> getAdditionalSessionProviders(Context context) {
        return null;
    }
}
