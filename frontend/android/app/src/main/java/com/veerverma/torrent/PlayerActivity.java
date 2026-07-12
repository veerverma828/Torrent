package com.veerverma.torrent;

import android.app.PictureInPictureParams;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.net.Uri;
import android.util.Rational;
import android.view.GestureDetector;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.ScaleGestureDetector;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.OptIn;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.PlaybackParameters;
import androidx.media3.common.Player;
import androidx.media3.common.TrackGroup;
import androidx.media3.common.TrackSelectionOverride;
import androidx.media3.common.Tracks;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.DefaultLoadControl;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.MediaSource;
import androidx.media3.exoplayer.source.ProgressiveMediaSource;
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector;
import androidx.media3.ui.AspectRatioFrameLayout;
import androidx.media3.ui.CaptionStyleCompat;
import androidx.media3.ui.PlayerView;
import androidx.media3.ui.SubtitleView;

import android.graphics.Color;

import com.getcapacitor.JSObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Native media3/ExoPlayer full-screen player. Decodes MKV/HEVC/AC3/DTS/10-bit
 * that the WebView cannot, and adds embedded subtitle/audio/quality selection,
 * gestures, playback speed, PiP, Chromecast and auto-play-next.
 *
 * Pure playback surface: it never resolves torrents/debrid links itself — the
 * URL arrives ready via the launch intent. Position + lifecycle are pushed to
 * JS through {@link NativePlayerPlugin#emit} so the web app keeps ownership of
 * progress/Trakt sync and next-episode resolution.
 */
@UnstableApi
public class PlayerActivity extends AppCompatActivity {

    public static final String EXTRA_URL = "url";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_SUBTITLE = "subtitle";
    public static final String EXTRA_START_MS = "startMs";
    public static final String EXTRA_START_PERCENT = "startPercent";
    public static final String EXTRA_METADATA = "metadata";
    public static final String EXTRA_HAS_NEXT = "hasNext";
    public static final String EXTRA_IS_TORRENT = "isTorrent";

    private static PlayerActivity current;

    private ExoPlayer player;
    private DefaultTrackSelector trackSelector;
    private PlayerView playerView;
    private CastController castController;

    private TextView gestureIndicator;
    private ProgressBar loadingSpinner;
    private LinearLayout nextOverlay;
    private TextView nextText;
    private TextView btnSpeed;
    private TextView btnAspect;
    private TextView btnSubtitles;
    private TextView btnAudio;
    private TextView btnNext;

    private String currentUrl;
    private boolean isTorrent = false;
    private String metadataJson = "{}";
    private boolean hasNext = false;
    private boolean endedEmitted = false;
    private boolean playNextRequested = false;
    private double pendingSeekPercent = 0.0;
    private boolean pendingSeekDone = false;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Handler countdownHandler = new Handler(Looper.getMainLooper());

    private AudioManager audioManager;
    private int maxVolume;
    private int aspectModeIndex = 0;
    private static final int[] ASPECT_MODES = {
            AspectRatioFrameLayout.RESIZE_MODE_FIT,
            AspectRatioFrameLayout.RESIZE_MODE_FILL,
            AspectRatioFrameLayout.RESIZE_MODE_ZOOM
    };
    private static final String[] ASPECT_LABELS = {"Fit", "Fill", "Zoom"};
    private static final float[] SPEEDS = {0.5f, 0.75f, 1f, 1.25f, 1.5f, 1.75f, 2f};

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_player);
        current = this;

        audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
        maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);

        playerView = findViewById(R.id.player_view);
        gestureIndicator = findViewById(R.id.gesture_indicator);
        loadingSpinner = findViewById(R.id.loading_spinner);
        nextOverlay = findViewById(R.id.next_overlay);
        nextText = findViewById(R.id.next_text);
        btnSpeed = findViewById(R.id.btn_speed);
        btnAspect = findViewById(R.id.btn_aspect);

        trackSelector = new DefaultTrackSelector(this);
        // Decoder fallback keeps audio/video playing on phones whose primary
        // decoder rejects a track (e.g. EAC3/DTS on budget devices) by trying
        // the next available codec instead of going silent.
        DefaultRenderersFactory renderersFactory = new DefaultRenderersFactory(this)
                .setEnableDecoderFallback(true)
                .setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_ON);
        // Faster start, deeper steady-state buffer: begin playback after just
        // ~1.5s is buffered (default 2.5s), resume after a stall at ~3s, and
        // keep buffering up to 3 minutes ahead so one slow debrid patch
        // doesn't cause repeated rebuffering mid-episode.
        DefaultLoadControl loadControl = new DefaultLoadControl.Builder()
                .setBufferDurationsMs(
                        /* minBufferMs= */ 30000,
                        /* maxBufferMs= */ 180000,
                        /* bufferForPlaybackMs= */ 1500,
                        /* bufferForPlaybackAfterRebufferMs= */ 3000)
                .setPrioritizeTimeOverSizeThresholds(true)
                .build();
        player = new ExoPlayer.Builder(this, renderersFactory)
                .setLoadControl(loadControl)
                .setTrackSelector(trackSelector)
                .setAudioAttributes(
                        new AudioAttributes.Builder()
                                .setUsage(C.USAGE_MEDIA)
                                .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
                                .build(),
                        /* handleAudioFocus= */ true)
                .setSeekBackIncrementMs(10000)
                .setSeekForwardIncrementMs(10000)
                .build();
        playerView.setPlayer(player);
        playerView.setControllerShowTimeoutMs(3500);
        // Our gesture layer owns all touch handling (tap toggle, swipes,
        // pinch); PlayerView's built-in tap-to-toggle would double-handle.
        playerView.setControllerHideOnTouch(false);
        playerView.setControllerAutoShow(false);

        // Stremio-style subtitles: clean white text with a black outline, no
        // background box, and ignore ugly styling embedded in subtitle files.
        SubtitleView subtitleView = playerView.getSubtitleView();
        if (subtitleView != null) {
            subtitleView.setStyle(new CaptionStyleCompat(
                    Color.WHITE,
                    Color.TRANSPARENT,          // no background box
                    Color.TRANSPARENT,          // no window color
                    CaptionStyleCompat.EDGE_TYPE_OUTLINE,
                    Color.BLACK,
                    null));                     // default typeface
            subtitleView.setApplyEmbeddedStyles(false);
            subtitleView.setApplyEmbeddedFontSizes(false);
            subtitleView.setFractionalTextSize(0.05f);
            subtitleView.setBottomPaddingFraction(0.06f);
        }

        player.addListener(playerListener);

        wireControls();
        setupGestures();
        castController = new CastController(this, player, playerView);

        loadFromIntent(getIntent());
        startProgressTicker();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        // Auto-next reuse: hide countdown, load the freshly-resolved episode.
        hideNextOverlay();
        loadingSpinner.setVisibility(View.GONE);
        playNextRequested = false;
        loadFromIntent(intent);
    }

    private void loadFromIntent(Intent intent) {
        String url = intent.getStringExtra(EXTRA_URL);
        currentUrl = url;
        String title = intent.getStringExtra(EXTRA_TITLE);
        String subtitle = intent.getStringExtra(EXTRA_SUBTITLE);
        long startMs = intent.getLongExtra(EXTRA_START_MS, 0L);
        pendingSeekPercent = intent.getDoubleExtra(EXTRA_START_PERCENT, 0.0);
        pendingSeekDone = false;
        metadataJson = intent.getStringExtra(EXTRA_METADATA);
        if (metadataJson == null) metadataJson = "{}";
        hasNext = intent.getBooleanExtra(EXTRA_HAS_NEXT, false);
        isTorrent = intent.getBooleanExtra(EXTRA_IS_TORRENT, false);
        endedEmitted = false;
        if (btnNext != null) btnNext.setVisibility(hasNext ? View.VISIBLE : View.GONE);

        TextView tvTitle = playerView.findViewById(R.id.tv_title);
        TextView tvSubtitle = playerView.findViewById(R.id.tv_subtitle);
        if (tvTitle != null) tvTitle.setText(title != null ? title : "");
        if (tvSubtitle != null) {
            if (subtitle != null && !subtitle.isEmpty()) {
                tvSubtitle.setText(subtitle);
                tvSubtitle.setVisibility(View.VISIBLE);
            } else {
                tvSubtitle.setVisibility(View.GONE);
            }
        }

        MediaItem item = new MediaItem.Builder()
                .setUri(isTorrent ? "torrent://stream" : url)
                .setMimeType(isTorrent ? null : guessMimeType(url))
                .setMediaMetadata(new MediaMetadata.Builder().setTitle(title).build())
                .build();

        if (isTorrent) {
            // No URL for torrent playback — feed ExoPlayer directly from the
            // growing file via a custom DataSource (see TorrentDataSource),
            // handed off from NativePlayerPlugin for this launch.
            NativePlayerPlugin.PendingTorrent pending = NativePlayerPlugin.consumePendingTorrent();
            if (pending == null) {
                showGesture("Torrent stream not found");
                finish();
                return;
            }
            MediaSource source = new ProgressiveMediaSource.Factory(
                    new TorrentDataSource.Factory(pending.engine, pending.fileHandle))
                    .createMediaSource(item);
            player.setMediaSource(source);
        } else {
            player.setMediaItem(item);
        }
        player.prepare();
        if (startMs > 0) player.seekTo(startMs);
        player.setPlayWhenReady(true);
    }

    private String guessMimeType(String url) {
        // Only pin the MIME type where it genuinely helps (HLS manifests need
        // it to pick the right MediaSource). For files, returning null lets
        // ExoPlayer sniff the container — previously .mkv was mislabeled as
        // WebM and everything else forced to MP4, which can derail extractor
        // selection and track handling.
        if (url == null) return null;
        String u = url.toLowerCase();
        if (u.contains(".m3u8")) return MimeTypes.APPLICATION_M3U8;
        if (u.contains(".mkv")) return MimeTypes.VIDEO_MATROSKA;
        return null;
    }

    // ===================== controls wiring =====================

    private void wireControls() {
        ImageButton btnClose = playerView.findViewById(R.id.btn_close);
        ImageButton btnPip = playerView.findViewById(R.id.btn_pip);
        btnSubtitles = playerView.findViewById(R.id.btn_subtitles);
        btnAudio = playerView.findViewById(R.id.btn_audio);
        btnNext = playerView.findViewById(R.id.btn_next);
        TextView btnExternal = playerView.findViewById(R.id.btn_external);

        if (btnClose != null) btnClose.setOnClickListener(v -> finish());
        if (btnPip != null) {
            // No PiP on TV / Fire TV — hide the button instead of a dead tap.
            if (getPackageManager().hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)) {
                btnPip.setOnClickListener(v -> enterPip());
            } else {
                btnPip.setVisibility(View.GONE);
            }
        }
        if (btnSubtitles != null) btnSubtitles.setOnClickListener(v -> showTrackDialog(C.TRACK_TYPE_TEXT, "Subtitles"));
        if (btnAudio != null) btnAudio.setOnClickListener(v -> showTrackDialog(C.TRACK_TYPE_AUDIO, "Audio"));
        if (btnSpeed != null) btnSpeed.setOnClickListener(v -> showSpeedDialog());
        if (btnAspect != null) btnAspect.setOnClickListener(v -> cycleAspect());
        if (btnNext != null) {
            btnNext.setVisibility(hasNext ? View.VISIBLE : View.GONE);
            btnNext.setOnClickListener(v -> triggerPlayNext());
        }
        if (btnExternal != null) btnExternal.setOnClickListener(v -> openExternal());

        TextView nextCancel = findViewById(R.id.next_cancel);
        TextView nextPlay = findViewById(R.id.next_play);
        if (nextCancel != null) nextCancel.setOnClickListener(v -> hideNextOverlay());
        if (nextPlay != null) nextPlay.setOnClickListener(v -> triggerPlayNext());
    }

    /** Hand the current stream to an external player (VLC/MX/...) and close. */
    private void openExternal() {
        if (currentUrl == null) return;
        try {
            // Flush progress first so resume works when they come back.
            emitProgressSafe();
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(Uri.parse(currentUrl), "video/*");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(Intent.createChooser(intent, "Open with"));
            finish();
        } catch (Exception e) {
            showGesture("No external player found");
        }
    }

    // ===================== TV remote / D-pad =====================

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getAction() == KeyEvent.ACTION_DOWN && player != null) {
            int code = event.getKeyCode();
            boolean controllerVisible = playerView.isControllerFullyVisible();
            boolean overlayVisible = nextOverlay.getVisibility() == View.VISIBLE;

            switch (code) {
                // Play/pause keys always act directly, without pulling up the
                // controls — the Netflix/Stremio behavior remotes expect.
                case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
                    player.setPlayWhenReady(!player.getPlayWhenReady());
                    showGesture(player.getPlayWhenReady() ? "Play" : "Pause");
                    return true;
                case KeyEvent.KEYCODE_MEDIA_PLAY:
                    player.setPlayWhenReady(true);
                    showGesture("Play");
                    return true;
                case KeyEvent.KEYCODE_MEDIA_PAUSE:
                    player.setPlayWhenReady(false);
                    showGesture("Pause");
                    return true;
                case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:
                    seekBy(30000);
                    return true;
                case KeyEvent.KEYCODE_MEDIA_REWIND:
                    seekBy(-30000);
                    return true;

                case KeyEvent.KEYCODE_DPAD_LEFT:
                    // Hidden controls: left/right seek immediately.
                    if (!controllerVisible && !overlayVisible) {
                        seekBy(-10000);
                        return true;
                    }
                    break;
                case KeyEvent.KEYCODE_DPAD_RIGHT:
                    if (!controllerVisible && !overlayVisible) {
                        seekBy(10000);
                        return true;
                    }
                    break;

                case KeyEvent.KEYCODE_DPAD_UP:
                case KeyEvent.KEYCODE_DPAD_DOWN:
                case KeyEvent.KEYCODE_DPAD_CENTER:
                case KeyEvent.KEYCODE_ENTER:
                    if (!controllerVisible && !overlayVisible) {
                        showControllerAndFocus();
                        return true;
                    }
                    break;

                case KeyEvent.KEYCODE_BACK:
                    // Back peels UI layers before exiting: countdown overlay,
                    // then the controls, and only then the player itself.
                    if (overlayVisible) {
                        hideNextOverlay();
                        return true;
                    }
                    if (controllerVisible) {
                        playerView.hideController();
                        return true;
                    }
                    break;
            }
        }
        return super.dispatchKeyEvent(event);
    }

    private void seekBy(long deltaMs) {
        long duration = player.getDuration();
        long target = Math.max(0, player.getCurrentPosition() + deltaMs);
        if (duration > 0) target = Math.min(target, duration);
        player.seekTo(target);
        showGesture(deltaMs < 0 ? "« " + (-deltaMs / 1000) + "s" : (deltaMs / 1000) + "s »");
    }

    private void showControllerAndFocus() {
        playerView.showController();
        View playPause = playerView.findViewById(androidx.media3.ui.R.id.exo_play_pause);
        if (playPause != null) playPause.post(playPause::requestFocus);
    }

    private void cycleAspect() {
        aspectModeIndex = (aspectModeIndex + 1) % ASPECT_MODES.length;
        playerView.setResizeMode(ASPECT_MODES[aspectModeIndex]);
        if (btnAspect != null) btnAspect.setText(ASPECT_LABELS[aspectModeIndex]);
    }

    private void showSpeedDialog() {
        float currentSpeed = player.getPlaybackParameters().speed;
        String[] labels = new String[SPEEDS.length];
        int checked = 2;
        for (int i = 0; i < SPEEDS.length; i++) {
            labels[i] = SPEEDS[i] + "x";
            if (Math.abs(SPEEDS[i] - currentSpeed) < 0.01f) checked = i;
        }
        new AlertDialog.Builder(this, R.style.PlayerDialog)
                .setTitle("Playback speed")
                .setSingleChoiceItems(labels, checked, (dialog, which) -> {
                    player.setPlaybackParameters(new PlaybackParameters(SPEEDS[which]));
                    if (btnSpeed != null) btnSpeed.setText(labels[which]);
                    dialog.dismiss();
                })
                .show();
    }

    private void showTrackDialog(int trackType, String title) {
        Tracks tracks = player.getCurrentTracks();
        List<Tracks.Group> groups = new ArrayList<>();
        for (Tracks.Group g : tracks.getGroups()) {
            if (g.getType() == trackType) groups.add(g);
        }

        List<String> labels = new ArrayList<>();
        List<int[]> selections = new ArrayList<>(); // {groupIndex, trackIndex} into groups list

        boolean allowDisable = trackType == C.TRACK_TYPE_TEXT;
        if (allowDisable) {
            labels.add("Off");
            selections.add(new int[]{-1, -1});
        }
        labels.add("Auto");
        selections.add(new int[]{-2, -2});

        for (int gi = 0; gi < groups.size(); gi++) {
            Tracks.Group g = groups.get(gi);
            for (int ti = 0; ti < g.length; ti++) {
                // Show unsupported tracks too (marked) — hiding them made
                // multi-audio files look single-track on phones whose decoder
                // rejects e.g. DTS; with decoder fallback enabled selecting
                // them can still work.
                String label = formatTrack(trackType, g, ti, labels.size());
                if (!g.isTrackSupported(ti)) label += " (unsupported)";
                labels.add(label);
                selections.add(new int[]{gi, ti});
            }
        }

        if (labels.size() <= (allowDisable ? 2 : 1)) {
            new AlertDialog.Builder(this, R.style.PlayerDialog)
                    .setTitle(title)
                    .setMessage("No " + title.toLowerCase() + " tracks in this file.")
                    .setPositiveButton("OK", null)
                    .show();
            return;
        }

        // Highlight what's playing now: the selected embedded track, else
        // "Off" (text) / "Auto".
        int checked = allowDisable ? 0 : 0; // default: Off (text) or Auto
        for (int i = 0; i < selections.size(); i++) {
            int[] s = selections.get(i);
            if (s[0] >= 0 && groups.get(s[0]).isTrackSelected(s[1])) {
                checked = i;
                break;
            }
        }

        final int trackTypeFinal = trackType;
        new AlertDialog.Builder(this, R.style.PlayerDialog)
                .setTitle(title)
                .setSingleChoiceItems(labels.toArray(new String[0]), checked, (dialog, which) -> {
                    int[] sel = selections.get(which);
                    applyTrackSelection(trackTypeFinal, sel, groups);
                    updatePillLabel(trackTypeFinal, labels.get(which));
                    dialog.dismiss();
                })
                .show();
    }

    private void updatePillLabel(int trackType, String value) {
        String v = value.length() > 10 ? value.substring(0, 10) : value;
        if (trackType == C.TRACK_TYPE_TEXT && btnSubtitles != null) btnSubtitles.setText(v);
        else if (trackType == C.TRACK_TYPE_AUDIO && btnAudio != null) btnAudio.setText(v);
    }

    private String formatTrack(int trackType, Tracks.Group g, int ti, int fallbackIdx) {
        androidx.media3.common.Format f = g.getTrackFormat(ti);
        if (trackType == C.TRACK_TYPE_VIDEO) {
            if (f.height > 0) return f.height + "p";
            return "Track " + fallbackIdx;
        }
        StringBuilder sb = new StringBuilder();
        if (f.language != null) sb.append(f.language.toUpperCase());
        else sb.append("Track " + fallbackIdx);
        if (f.label != null) sb.append(" · ").append(f.label);
        if (trackType == C.TRACK_TYPE_AUDIO && f.channelCount > 0) {
            sb.append(" · ").append(f.channelCount).append("ch");
        }
        return sb.toString();
    }

    private void applyTrackSelection(int trackType, int[] sel, List<Tracks.Group> groups) {
        DefaultTrackSelector.Parameters.Builder params = trackSelector.buildUponParameters();
        if (sel[0] == -1) { // Off
            params.setTrackTypeDisabled(trackType, true);
            params.clearOverridesOfType(trackType);
        } else if (sel[0] == -2) { // Auto
            params.setTrackTypeDisabled(trackType, false);
            params.clearOverridesOfType(trackType);
        } else {
            params.setTrackTypeDisabled(trackType, false);
            TrackGroup mediaGroup = groups.get(sel[0]).getMediaTrackGroup();
            params.setOverrideForType(new TrackSelectionOverride(mediaGroup, sel[1]));
        }
        trackSelector.setParameters(params.build());
    }

    // ===================== gestures =====================

    private void setupGestures() {
        // Attach to the PlayerView itself: it's the topmost touch target, so a
        // listener on the activity root never fires (the PlayerView consumes
        // every event first) — that's why swipes were dead on phones.
        View root = playerView;

        GestureDetector tapDetector = new GestureDetector(this, new GestureDetector.SimpleOnGestureListener() {
            @Override
            public boolean onDoubleTap(@NonNull MotionEvent e) {
                float x = e.getX();
                if (x < root.getWidth() / 3f) {
                    player.seekTo(Math.max(0, player.getCurrentPosition() - 10000));
                    showGesture("« 10s");
                } else if (x > root.getWidth() * 2f / 3f) {
                    player.seekTo(player.getCurrentPosition() + 10000);
                    showGesture("10s »");
                } else {
                    player.setPlayWhenReady(!player.getPlayWhenReady());
                }
                return true;
            }

            @Override
            public boolean onSingleTapConfirmed(@NonNull MotionEvent e) {
                if (playerView.isControllerFullyVisible()) playerView.hideController();
                else playerView.showController();
                return true;
            }
        });

        ScaleGestureDetector scaleDetector = new ScaleGestureDetector(this,
                new ScaleGestureDetector.SimpleOnScaleGestureListener() {
                    @Override
                    public boolean onScale(@NonNull ScaleGestureDetector detector) {
                        if (detector.getScaleFactor() > 1.05f && aspectModeIndex != 2) {
                            aspectModeIndex = 2;
                            playerView.setResizeMode(ASPECT_MODES[2]);
                            if (btnAspect != null) btnAspect.setText(ASPECT_LABELS[2]);
                        } else if (detector.getScaleFactor() < 0.95f && aspectModeIndex != 0) {
                            aspectModeIndex = 0;
                            playerView.setResizeMode(ASPECT_MODES[0]);
                            if (btnAspect != null) btnAspect.setText(ASPECT_LABELS[0]);
                        }
                        return true;
                    }
                });

        root.setOnTouchListener(new View.OnTouchListener() {
            private float startY;
            private float startX;
            private boolean isVertical;
            private boolean isHorizontal;
            private boolean leftSide;
            private float startBrightness;
            private int startVolume;
            private long seekBasePosition;
            private long seekDelta;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                scaleDetector.onTouchEvent(event);
                tapDetector.onTouchEvent(event);
                if (scaleDetector.isInProgress()) return true;

                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        startY = event.getY();
                        startX = event.getX();
                        isVertical = false;
                        isHorizontal = false;
                        seekDelta = 0;
                        leftSide = startX < v.getWidth() / 2f;
                        startBrightness = getWindow().getAttributes().screenBrightness;
                        if (startBrightness < 0) startBrightness = 0.5f;
                        startVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC);
                        seekBasePosition = player != null ? player.getCurrentPosition() : 0;
                        break;
                    case MotionEvent.ACTION_MOVE:
                        float dy = startY - event.getY();
                        float dx = event.getX() - startX;
                        if (!isVertical && !isHorizontal && Math.abs(dy) > 40 && Math.abs(dy) > Math.abs(dx)) {
                            isVertical = true;
                        } else if (!isVertical && !isHorizontal && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
                            isHorizontal = true;
                        }
                        if (isVertical) {
                            float frac = dy / v.getHeight();
                            if (leftSide) adjustBrightness(startBrightness + frac);
                            else adjustVolume(startVolume + Math.round(frac * maxVolume * 1.5f));
                            return true;
                        }
                        if (isHorizontal) {
                            // Full-width swipe ≈ ±90s; preview only, seek on release
                            seekDelta = (long) (dx / v.getWidth() * 90000);
                            long preview = Math.max(0, seekBasePosition + seekDelta);
                            showGesture((seekDelta >= 0 ? "+" : "−") + Math.abs(seekDelta / 1000) + "s  ·  " + formatMs(preview));
                            return true;
                        }
                        break;
                    case MotionEvent.ACTION_UP:
                    case MotionEvent.ACTION_CANCEL:
                        if (isHorizontal && Math.abs(seekDelta) > 1000 && player != null
                                && event.getAction() == MotionEvent.ACTION_UP) {
                            long duration = player.getDuration();
                            long target = Math.max(0, seekBasePosition + seekDelta);
                            if (duration > 0) target = Math.min(target, duration);
                            player.seekTo(target);
                        }
                        if (isVertical || isHorizontal) {
                            hideGestureSoon();
                        }
                        break;
                }
                // Consume everything: taps are handled by our GestureDetector
                // above, and letting PlayerView's own onTouchEvent run would
                // re-toggle the controller and fight the swipe gestures.
                return true;
            }
        });
    }

    private void adjustBrightness(float value) {
        float b = Math.max(0.02f, Math.min(1f, value));
        WindowManager.LayoutParams lp = getWindow().getAttributes();
        lp.screenBrightness = b;
        getWindow().setAttributes(lp);
        showGesture("Brightness " + Math.round(b * 100) + "%");
    }

    private void adjustVolume(int value) {
        int v = Math.max(0, Math.min(maxVolume, value));
        audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, v, 0);
        showGesture("Volume " + Math.round(v * 100f / maxVolume) + "%");
    }

    private String formatMs(long ms) {
        long totalSec = ms / 1000;
        long h = totalSec / 3600;
        long m = (totalSec % 3600) / 60;
        long s = totalSec % 60;
        return h > 0
                ? String.format(java.util.Locale.US, "%d:%02d:%02d", h, m, s)
                : String.format(java.util.Locale.US, "%d:%02d", m, s);
    }

    private void showGesture(String text) {
        gestureIndicator.setText(text);
        gestureIndicator.setVisibility(View.VISIBLE);
        hideGestureSoon();
    }

    private void hideGestureSoon() {
        handler.removeCallbacks(hideGestureRunnable);
        handler.postDelayed(hideGestureRunnable, 700);
    }

    private final Runnable hideGestureRunnable = () -> gestureIndicator.setVisibility(View.GONE);

    // ===================== PiP =====================

    private void enterPip() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        if (!getPackageManager().hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)) return;
        Rational ratio = new Rational(16, 9);
        PictureInPictureParams params = new PictureInPictureParams.Builder()
                .setAspectRatio(ratio).build();
        enterPictureInPictureMode(params);
    }

    @Override
    public void onPictureInPictureModeChanged(boolean isInPip, @NonNull android.content.res.Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPip, newConfig);
        playerView.setUseController(!isInPip);
    }

    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        // Auto-enter PiP when the user navigates away mid-playback.
        if (player != null && player.isPlaying()) enterPip();
    }

    // ===================== auto-next =====================

    private int countdown = 10;
    private final Runnable countdownRunnable = new Runnable() {
        @Override
        public void run() {
            countdown--;
            if (countdown <= 0) {
                triggerPlayNext();
            } else {
                nextText.setText("Next episode in " + countdown + "s");
                countdownHandler.postDelayed(this, 1000);
            }
        }
    };

    private void showNextOverlay() {
        countdown = 10;
        nextText.setText("Next episode in 10s");
        nextOverlay.setVisibility(View.VISIBLE);
        countdownHandler.postDelayed(countdownRunnable, 1000);
        // Land remote focus on "Play now" so a single OK press continues.
        View nextPlay = findViewById(R.id.next_play);
        if (nextPlay != null) nextPlay.post(nextPlay::requestFocus);
    }

    private void hideNextOverlay() {
        countdownHandler.removeCallbacks(countdownRunnable);
        nextOverlay.setVisibility(View.GONE);
    }

    private void triggerPlayNext() {
        if (playNextRequested) return;
        playNextRequested = true;
        hideNextOverlay();
        loadingSpinner.setVisibility(View.VISIBLE);
        emit("playNext", baseEvent());
        // JS resolves the next episode URL and calls play() again → onNewIntent.
    }

    // ===================== progress + events =====================

    private final Runnable progressTicker = new Runnable() {
        @Override
        public void run() {
            if (player != null && player.getDuration() > 0 && player.isPlaying()) {
                emitProgress();
            }
            handler.postDelayed(this, 5000);
        }
    };

    private void startProgressTicker() {
        handler.postDelayed(progressTicker, 5000);
    }

    private void emitProgress() {
        JSObject data = baseEvent();
        data.put("positionMs", player.getCurrentPosition());
        data.put("durationMs", player.getDuration());
        emit("progress", data);
    }

    private JSObject baseEvent() {
        JSObject data = new JSObject();
        data.put("metadata", metadataJson);
        if (player != null) {
            data.put("positionMs", player.getCurrentPosition());
            data.put("durationMs", Math.max(0, player.getDuration()));
        }
        return data;
    }

    private void emit(String event, JSObject data) {
        NativePlayerPlugin.emit(event, data);
    }

    private final Player.Listener playerListener = new Player.Listener() {
        @Override
        public void onPlaybackStateChanged(int state) {
            if (state == Player.STATE_BUFFERING) {
                loadingSpinner.setVisibility(View.VISIBLE);
            } else if (state == Player.STATE_READY) {
                if (!playNextRequested) loadingSpinner.setVisibility(View.GONE);
                // Resume is stored as a percentage; the offset can only be
                // derived once the real duration is known.
                if (!pendingSeekDone && pendingSeekPercent > 0 && player.getDuration() > 0) {
                    pendingSeekDone = true;
                    player.seekTo((long) (pendingSeekPercent / 100.0 * player.getDuration()));
                }
            } else if (state == Player.STATE_ENDED && !endedEmitted) {
                endedEmitted = true;
                emit("ended", baseEvent());
                if (hasNext) showNextOverlay();
            }
        }

        @Override
        public void onIsPlayingChanged(boolean isPlaying) {
            emit(isPlaying ? "resumed" : "paused", baseEvent());
        }

        @Override
        public void onTracksChanged(@NonNull Tracks tracks) {
            // Seed the pills with what's actually playing so the current
            // audio/quality is visible without opening a menu.
            for (Tracks.Group g : tracks.getGroups()) {
                for (int i = 0; i < g.length; i++) {
                    if (!g.isTrackSelected(i)) continue;
                    if (g.getType() == C.TRACK_TYPE_AUDIO) updatePillLabel(C.TRACK_TYPE_AUDIO, formatTrack(C.TRACK_TYPE_AUDIO, g, i, 0));
                    else if (g.getType() == C.TRACK_TYPE_TEXT) updatePillLabel(C.TRACK_TYPE_TEXT, formatTrack(C.TRACK_TYPE_TEXT, g, i, 0));
                }
            }
        }

        @Override
        public void onPlayerError(@NonNull PlaybackException error) {
            JSObject data = baseEvent();
            data.put("message", error.getMessage() != null ? error.getMessage() : "Playback error");
            emit("error", data);
        }
    };

    // ===================== lifecycle =====================

    static void requestStop() {
        PlayerActivity a = current;
        if (a != null) a.runOnUiThread(a::finish);
    }

    @Override
    protected void onStop() {
        super.onStop();
        // Pause when backgrounded unless we're in PiP.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && isInPictureInPictureMode()) return;
        if (player != null) player.setPlayWhenReady(false);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        handler.removeCallbacksAndMessages(null);
        countdownHandler.removeCallbacksAndMessages(null);
        emitProgressSafe();
        emit("closed", baseEvent());
        // Tear down the torrent session + wipe its cache when P2P playback ends.
        if (isTorrent) NativePlayerPlugin.stopTorrent();
        if (castController != null) castController.release();
        if (player != null) {
            player.removeListener(playerListener);
            player.release();
            player = null;
        }
        if (current == this) current = null;
    }

    private void emitProgressSafe() {
        if (player != null && player.getDuration() > 0) emitProgress();
    }
}
