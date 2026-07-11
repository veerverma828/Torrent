package com.veerverma.torrent;

import android.content.Context;
import android.view.View;

import androidx.media3.common.MediaItem;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.cast.CastPlayer;
import androidx.media3.cast.SessionAvailabilityListener;
import androidx.media3.ui.PlayerView;
import androidx.mediarouter.app.MediaRouteButton;

import com.google.android.gms.cast.framework.CastButtonFactory;
import com.google.android.gms.cast.framework.CastContext;

/**
 * Optional Chromecast layer. Discovers a Cast session via the Cast SDK and,
 * when one connects, moves the current MediaItem + position onto a
 * {@link CastPlayer} and rebinds the PlayerView to it; on disconnect it hands
 * playback back to the local ExoPlayer at the casted position.
 *
 * Entirely best-effort: if Google Play services / the Cast framework are
 * unavailable the whole feature silently no-ops and local playback is
 * unaffected.
 */
@UnstableApi
public class CastController implements SessionAvailabilityListener {

    private final ExoPlayerHolder local;
    private final PlayerView playerView;
    private CastPlayer castPlayer;
    private boolean casting = false;

    interface ExoPlayerHolder {
        Player player();
    }

    CastController(Context context, Player localPlayer, PlayerView playerView) {
        this.local = () -> localPlayer;
        this.playerView = playerView;

        CastContext castContext;
        try {
            castContext = CastContext.getSharedInstance(context.getApplicationContext());
        } catch (Throwable t) {
            // Play services missing / not updated — Cast disabled, local only.
            return;
        }

        try {
            castPlayer = new CastPlayer(castContext);
            castPlayer.setSessionAvailabilityListener(this);

            MediaRouteButton routeButton = playerView.findViewById(R.id.media_route_button);
            if (routeButton != null) {
                CastButtonFactory.setUpMediaRouteButton(context.getApplicationContext(), routeButton);
                routeButton.setVisibility(View.VISIBLE);
            }
        } catch (Throwable t) {
            castPlayer = null;
        }
    }

    @Override
    public void onCastSessionAvailable() {
        if (castPlayer == null) return;
        Player localPlayer = local.player();
        MediaItem item = localPlayer.getCurrentMediaItem();
        long position = localPlayer.getCurrentPosition();
        localPlayer.setPlayWhenReady(false);

        if (item != null) {
            castPlayer.setMediaItem(item, position);
            castPlayer.prepare();
            castPlayer.setPlayWhenReady(true);
        }
        playerView.setPlayer(castPlayer);
        casting = true;
    }

    @Override
    public void onCastSessionUnavailable() {
        if (castPlayer == null) return;
        long position = castPlayer.getCurrentPosition();
        Player localPlayer = local.player();
        playerView.setPlayer(localPlayer);
        localPlayer.seekTo(position);
        localPlayer.setPlayWhenReady(true);
        casting = false;
    }

    boolean isCasting() {
        return casting;
    }

    void release() {
        if (castPlayer != null) {
            castPlayer.setSessionAvailabilityListener(null);
            castPlayer.release();
            castPlayer = null;
        }
    }
}
