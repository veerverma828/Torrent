/**
 * Cross-Device Trakt Synchronization
 * Real-time sync between multiple devices like Netflix
 */

class CrossDeviceSync {
  constructor() {
    this.isPolling = false;
    this.pollInterval = 15000; // 15 seconds
    this.lastSyncCheck = 0;
    this.activePolling = null;
    this.syncCallbacks = new Set();
  }

  /**
   * Check if Trakt cross-device sync is enabled and authenticated
   */
  isTraktSyncEnabled() {
    let syncMode = 'local';
    try {
      const stored = localStorage.getItem('syncMode');
      syncMode = stored ? JSON.parse(stored) : 'local';
    } catch {
      syncMode = 'local';
    }
    const accessToken = localStorage.getItem('trakt_access_token');
    return syncMode === 'trakt' && !!accessToken;
  }

  /**
   * Start real-time cross-device sync
   */
  startRealTimeSync() {
    if (this.isPolling) return;

    const isEnabled = this.isTraktSyncEnabled();
    console.log('[CrossDeviceSync] Detected syncMode:', localStorage.getItem('syncMode') || 'local');
    console.log('[CrossDeviceSync] Trakt authenticated:', !!localStorage.getItem('trakt_access_token'));

    if (!isEnabled) {
      console.log('[CrossDeviceSync] Trakt sync not enabled or not authenticated, skipping cross-device sync');
      return;
    }
    
    this.isPolling = true;
    console.log('[CrossDeviceSync] Starting real-time sync');
    
    // Initial sync
    this.performSyncCheck();
    
    // Start polling
    this.activePolling = setInterval(() => {
      this.performSyncCheck();
    }, this.pollInterval);
    
    // Listen for tab visibility changes
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.performSyncCheck();
      }
    });
    
    // Listen for online/offline
    window.addEventListener('online', () => {
      this.performSyncCheck();
    });
    
    // Listen for storage changes (sync mode, auth changes)
    window.addEventListener('storage', (e) => {
      if (e.key === 'syncMode' || e.key === 'trakt_access_token' || e.key === 'trakt_user') {
        console.log('[CrossDeviceSync] Storage changed, restarting sync');
        this.stopRealTimeSync();
        this.startRealTimeSync();
      }
    });
  }

  /**
   * Stop real-time sync
   */
  stopRealTimeSync() {
    if (!this.isPolling) return;
    
    this.isPolling = false;
    if (this.activePolling) {
      clearInterval(this.activePolling);
      this.activePolling = null;
    }
    
    console.log('[CrossDeviceSync] Stopped real-time sync');
  }

  /**
   * Perform sync check and trigger updates
   */
  async performSyncCheck() {
    if (!this.isTraktSyncEnabled()) return;

    try {
      const now = Date.now();

      // Throttle - don't check too frequently
      if (now - this.lastSyncCheck < 5000) return;
      this.lastSyncCheck = now;

      // Get remote playback sessions
      const remoteSessions = await this.getRemotePlaybackSessions();
      
      // Get local playback state
      const localSessions = this.getLocalPlaybackSessions();
      
      // Detect changes and trigger sync
      const changes = this.detectChanges(remoteSessions, localSessions);
      
      if (changes.length > 0) {
        console.log(`[CrossDeviceSync] Detected ${changes.length} cross-device changes`);
        await this.processChanges(changes);
      }
      
    } catch (error) {
      console.error('[CrossDeviceSync] Sync check failed:', error);
    }
  }

  /**
   * Get remote playback sessions from Trakt
   */
  async getRemotePlaybackSessions() {
    try {
      const { traktApi } = await import('../trakt/traktApi.js');
      const response = await traktApi.request('/sync/playback');
      
      return response.map(item => ({
        type: item.type,
        id: item.type === 'movie' ? item.movie?.ids?.imdb : item.show?.ids?.imdb,
        progress: item.progress || 0,
        paused_at: item.paused_at,
        started_at: item.started_at,
        expires_at: item.expires_at,
        // Series specific
        season: item.episode?.season,
        episode: item.episode?.number,
        episodeTitle: item.episode?.title,
        showTitle: item.show?.title,
        movieTitle: item.movie?.title,
        year: item.movie?.year || item.show?.year
      }));
    } catch (error) {
      console.error('[CrossDeviceSync] Failed to get remote sessions:', error);
      return [];
    }
  }

  /**
   * Get local playback sessions
   */
  getLocalPlaybackSessions() {
    try {
      const localData = localStorage.getItem('trakt_active_sessions');
      if (!localData) return [];
      
      const sessions = JSON.parse(localData);
      return Object.entries(sessions).map(([key, session]) => ({
        sessionKey: key,
        ...session
      }));
    } catch (error) {
      console.error('[CrossDeviceSync] Failed to get local sessions:', error);
      return [];
    }
  }

  /**
   * Detect changes between remote and local sessions
   */
  detectChanges(remoteSessions, localSessions) {
    const changes = [];
    
    // Check for new remote sessions (started on other device)
    for (const remote of remoteSessions) {
      const localMatch = localSessions.find(local => 
        this.getSessionKey(remote) === local.sessionKey
      );
      
      if (!localMatch) {
        changes.push({
          type: 'new_session',
          data: remote,
          message: `Started watching ${this.getItemTitle(remote)} on another device`
        });
      } else {
        // Check for progress updates
        const progressDiff = Math.abs(remote.progress - localMatch.lastProgress);
        if (progressDiff > 5) { // 5% threshold
          changes.push({
            type: 'progress_update',
            data: remote,
            localData: localMatch,
            message: `Progress updated for ${this.getItemTitle(remote)} on another device`
          });
        }
      }
    }
    
    // Check for sessions that ended on other device
    for (const local of localSessions) {
      const remoteMatch = remoteSessions.find(remote => 
        this.getSessionKey(remote) === local.sessionKey
      );
      
      if (!remoteMatch && local.state === 'active') {
        changes.push({
          type: 'session_ended',
          data: local,
          message: `Stopped watching ${this.getItemTitle(local)} on another device`
        });
      }
    }
    
    return changes;
  }

  /**
   * Process detected changes
   */
  async processChanges(changes) {
    for (const change of changes) {
      await this.processChange(change);
    }
    
    // Notify all listeners
    this.notifySyncUpdate(changes);
  }

  /**
   * Process individual change
   */
  async processChange(change) {
    const { type, data } = change;
    
    switch (type) {
      case 'new_session':
        await this.handleNewRemoteSession(data);
        break;
      case 'progress_update':
        await this.handleProgressUpdate(data);
        break;
      case 'session_ended':
        await this.handleSessionEnded(data);
        break;
    }
  }

  /**
   * Handle new remote session
   */
  async handleNewRemoteSession(data) {
    console.log(`[CrossDeviceSync] New remote session: ${this.getItemTitle(data)}`);
    
    // Update local state to reflect remote session
    const localProvider = await import('../../trackers/providers/localProvider.js');
    
    if (data.type === 'movie') {
      await localProvider.localProvider.syncMovieProgress({
        type: 'movie',
        id: data.id,
        imdbId: data.id,
        title: data.movieTitle,
        year: data.year
      }, data.progress);
    } else if (data.type === 'episode') {
      await localProvider.localProvider.syncEpisodeProgress({
        type: 'series',
        id: data.id,
        imdbId: data.id,
        seriesTitle: data.showTitle,
        season: data.season,
        episode: data.episode,
        episodeTitle: data.episodeTitle
      }, data.progress);
    }
    
    // Clear continue watching cache to force refresh
    const { continueWatchingAggregator } = await import('./continueWatchingAggregator.js');
    continueWatchingAggregator.clearCache();
  }

  /**
   * Handle progress update from remote device
   */
  async handleProgressUpdate(data) {
    console.log(`[CrossDeviceSync] Progress update: ${this.getItemTitle(data)} - ${data.progress}%`);
    
    // Update local progress
    const localProvider = await import('../../trackers/providers/localProvider.js');
    
    if (data.type === 'movie') {
      await localProvider.localProvider.syncMovieProgress({
        type: 'movie',
        id: data.id,
        imdbId: data.id,
        title: data.movieTitle,
        year: data.year
      }, data.progress);
    } else if (data.type === 'episode') {
      await localProvider.localProvider.syncEpisodeProgress({
        type: 'series',
        id: data.id,
        imdbId: data.id,
        seriesTitle: data.showTitle,
        season: data.season,
        episode: data.episode,
        episodeTitle: data.episodeTitle
      }, data.progress);
    }
    
    // Clear continue watching cache
    const { continueWatchingAggregator } = await import('./continueWatchingAggregator.js');
    continueWatchingAggregator.clearCache();
  }

  /**
   * Handle session ended on remote device
   */
  async handleSessionEnded(data) {
    console.log(`[CrossDeviceSync] Session ended: ${this.getItemTitle(data)}`);
    
    // Update local state to mark as completed/inactive
    const localProvider = await import('../../trackers/providers/localProvider.js');
    
    if (data.metadata?.type === 'movie') {
      await localProvider.localProvider.syncMovieProgress(data.metadata, 100);
    } else if (data.metadata?.type === 'series') {
      await localProvider.localProvider.syncEpisodeProgress(data.metadata, 100);
    }
    
    // Clear continue watching cache
    const { continueWatchingAggregator } = await import('./continueWatchingAggregator.js');
    continueWatchingAggregator.clearCache();
  }

  /**
   * Get session key for item
   */
  getSessionKey(item) {
    if (item.type === 'movie') {
      return `movie-${item.id}`;
    } else if (item.type === 'episode') {
      return `series-${item.id}-${item.season}-${item.episode}`;
    }
    return `${item.type}-${item.id}`;
  }

  /**
   * Get item title for display
   */
  getItemTitle(item) {
    if (item.type === 'movie') {
      return item.movieTitle || 'Unknown Movie';
    } else if (item.type === 'episode') {
      return `${item.showTitle} S${item.season}E${item.episode}`;
    }
    return 'Unknown';
  }

  /**
   * Notify all sync callbacks
   */
  notifySyncUpdate(changes) {
    const update = {
      timestamp: Date.now(),
      changes: changes,
      message: changes.length > 0 ? changes[0].message : 'Sync updated'
    };
    
    this.syncCallbacks.forEach(callback => {
      try {
        callback(update);
      } catch (error) {
        console.error('[CrossDeviceSync] Callback error:', error);
      }
    });
  }

  /**
   * Add sync update listener
   */
  addSyncListener(callback) {
    this.syncCallbacks.add(callback);
    return () => this.syncCallbacks.delete(callback);
  }

  /**
   * Force immediate sync check
   */
  async forceSync() {
    if (!this.isTraktSyncEnabled()) {
      console.log('[CrossDeviceSync] Force sync skipped: Trakt not enabled or authenticated');
      return;
    }
    console.log('[CrossDeviceSync] Force sync triggered');
    await this.performSyncCheck();
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    return {
      isPolling: this.isPolling,
      pollInterval: this.pollInterval,
      lastSyncCheck: this.lastSyncCheck,
      listeners: this.syncCallbacks.size
    };
  }
}

export const crossDeviceSync = new CrossDeviceSync();
