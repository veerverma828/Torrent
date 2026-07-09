/**
 * Production-Grade Playback Event Handler
 * Manages video player events with proper debouncing and state tracking
 */

class PlaybackEventHandler {
  constructor(videoElement, metadata, callbacks = {}) {
    this.video = videoElement;
    this.metadata = metadata;
    this.callbacks = callbacks;
    
    // State tracking
    this.isPlaying = false;
    this.isSeeking = false;
    this.lastTime = 0;
    this.lastProgressUpdate = 0;
    this.playbackStartTime = 0;
    this.totalWatchTime = 0;
    this.sessionId = this.generateSessionId();
    
    // Timing constants
    this.PROGRESS_UPDATE_INTERVAL = 5000; // 5 seconds
    this.SEEK_THRESHOLD = 2; // seconds
    this.MIN_WATCH_TIME = 30000; // 30 seconds before tracking

    // Bind each handler exactly once and keep the reference, so destroy()
    // can remove the *same* function it added — removeEventListener only
    // matches identical references, and re-binding inline at removal time
    // (the old bug here) silently no-ops every call.
    this.handlePlay = this.handlePlay.bind(this);
    this.handlePause = this.handlePause.bind(this);
    this.handleEnded = this.handleEnded.bind(this);
    this.handleSeeking = this.handleSeeking.bind(this);
    this.handleSeeked = this.handleSeeked.bind(this);
    this.handleTimeUpdate = this.handleTimeUpdate.bind(this);
    this.handleLoadedMetadata = this.handleLoadedMetadata.bind(this);
    this.handleError = this.handleError.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleBeforeUnload = this.handleBeforeUnload.bind(this);

    this.initializeEventListeners();
  }

  generateSessionId() {
    return `${this.metadata.type}-${this.metadata.imdbId}-${Date.now()}`;
  }

  initializeEventListeners() {
    // Playback events
    this.video.addEventListener('play', this.handlePlay);
    this.video.addEventListener('pause', this.handlePause);
    this.video.addEventListener('ended', this.handleEnded);
    this.video.addEventListener('seeking', this.handleSeeking);
    this.video.addEventListener('seeked', this.handleSeeked);
    this.video.addEventListener('timeupdate', this.handleTimeUpdate);
    this.video.addEventListener('loadedmetadata', this.handleLoadedMetadata);
    this.video.addEventListener('error', this.handleError);

    // Page visibility events
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    // Before unload
    window.addEventListener('beforeunload', this.handleBeforeUnload);
  }

  handlePlay(event) {
    if (this.isPlaying) return; // Prevent duplicate play events

    this.isPlaying = true;
    this.playbackStartTime = Date.now();
    // Baseline lastProgressUpdate here — otherwise the first accumulation
    // in handleTimeUpdate computes `now - 0`, inflating totalWatchTime by
    // the entire Unix timestamp on the very first tick.
    this.lastProgressUpdate = Date.now();

    const percentage = this.calculateProgress();
    
    console.log(`[PlaybackEvent] Play started: ${this.metadata.title} (${percentage.toFixed(1)}%)`);
    
    if (this.callbacks.onPlay) {
      this.callbacks.onPlay(this.metadata, percentage);
    }
  }

  handlePause(event) {
    if (!this.isPlaying) return; // Prevent duplicate pause events
    
    this.isPlaying = false;
    this.updateTotalWatchTime();
    
    const percentage = this.calculateProgress();
    
    console.log(`[PlaybackEvent] Playback paused: ${this.metadata.title} (${percentage.toFixed(1)}%)`);
    
    if (this.callbacks.onPause) {
      this.callbacks.onPause(this.metadata, percentage);
    }
  }

  handleEnded(event) {
    this.isPlaying = false;
    this.updateTotalWatchTime();
    
    const percentage = 100;
    const totalWatchTimeSeconds = this.totalWatchTime / 1000;
    
    console.log(`[PlaybackEvent] Playback ended: ${this.metadata.title} (${totalWatchTimeSeconds}s watched)`);
    
    if (this.callbacks.onEnded) {
      this.callbacks.onEnded(this.metadata, percentage, totalWatchTimeSeconds);
    }
  }

  handleSeeking(event) {
    this.isSeeking = true;
  }

  handleSeeked(event) {
    this.isSeeking = false;
    this.lastTime = this.video.currentTime;
  }

  handleTimeUpdate(event) {
    const now = Date.now();
    const currentTime = this.video.currentTime;
    
    // Skip if seeking or invalid time
    if (this.isSeeking || !currentTime || currentTime === this.lastTime) {
      return;
    }
    
    // Update total watch time if playing
    if (this.isPlaying) {
      this.totalWatchTime += now - this.lastProgressUpdate;
    }
    
    // Throttle progress updates
    if (now - this.lastProgressUpdate < this.PROGRESS_UPDATE_INTERVAL) {
      return;
    }

    // Don't start writing continue-watching/Trakt data for a trivial,
    // barely-started session.
    if (!this.shouldTrackProgress()) {
      return;
    }

    // Check for significant time jump (seek)
    const timeDiff = Math.abs(currentTime - this.lastTime);
    if (timeDiff > this.SEEK_THRESHOLD) {
      console.log(`[PlaybackEvent] Seek detected: ${this.lastTime}s → ${currentTime}s`);
      if (this.callbacks.onSeek) {
        this.callbacks.onSeek(this.metadata, currentTime, this.lastTime);
      }
    }
    
    this.lastTime = currentTime;
    this.lastProgressUpdate = now;
    
    // Update progress
    const percentage = this.calculateProgress();
    
    if (this.callbacks.onProgress) {
      this.callbacks.onProgress(this.metadata, currentTime, this.video.duration, percentage);
    }
  }

  handleLoadedMetadata(event) {
    console.log(`[PlaybackEvent] Metadata loaded: ${this.metadata.title} (${this.video.duration}s)`);
    
    if (this.callbacks.onLoadedMetadata) {
      this.callbacks.onLoadedMetadata(this.metadata, this.video.duration);
    }
  }

  handleError(event) {
    console.error(`[PlaybackEvent] Playback error: ${this.metadata.title}`, this.video.error);
    
    if (this.callbacks.onError) {
      this.callbacks.onError(this.metadata, this.video.error);
    }
  }

  handleVisibilityChange() {
    if (document.hidden) {
      // Page hidden - pause tracking
      if (this.isPlaying) {
        this.updateTotalWatchTime();
        console.log(`[PlaybackEvent] Page hidden, pausing tracking`);
      }
    } else {
      // Page visible - resume tracking
      if (this.isPlaying) {
        this.lastProgressUpdate = Date.now();
        console.log(`[PlaybackEvent] Page visible, resuming tracking`);
      }
    }
  }

  handleBeforeUnload(event) {
    // Save progress before page unload
    if (this.video.currentTime > 0) {
      const percentage = this.calculateProgress();
      
      if (this.callbacks.onBeforeUnload) {
        this.callbacks.onBeforeUnload(this.metadata, this.video.currentTime, this.video.duration, percentage);
      }
    }
  }

  calculateProgress() {
    if (!this.video.duration || this.video.duration === 0 || !Number.isFinite(this.video.duration)) {
      return 0;
    }
    
    return Math.min((this.video.currentTime / this.video.duration) * 100, 100);
  }

  updateTotalWatchTime() {
    if (this.isPlaying && this.lastProgressUpdate > 0) {
      this.totalWatchTime += Date.now() - this.lastProgressUpdate;
    }
  }

  getPlaybackStats() {
    return {
      sessionId: this.sessionId,
      isPlaying: this.isPlaying,
      currentTime: this.video.currentTime,
      duration: this.video.duration,
      percentage: this.calculateProgress(),
      totalWatchTime: this.totalWatchTime,
      playbackStartTime: this.playbackStartTime
    };
  }

  shouldTrackProgress() {
    // Only track if watched for minimum time
    return this.totalWatchTime >= this.MIN_WATCH_TIME;
  }

  destroy() {
    // Clean up event listeners (same bound references used in initializeEventListeners)
    this.video.removeEventListener('play', this.handlePlay);
    this.video.removeEventListener('pause', this.handlePause);
    this.video.removeEventListener('ended', this.handleEnded);
    this.video.removeEventListener('seeking', this.handleSeeking);
    this.video.removeEventListener('seeked', this.handleSeeked);
    this.video.removeEventListener('timeupdate', this.handleTimeUpdate);
    this.video.removeEventListener('loadedmetadata', this.handleLoadedMetadata);
    this.video.removeEventListener('error', this.handleError);

    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
  }
}

export default PlaybackEventHandler;
