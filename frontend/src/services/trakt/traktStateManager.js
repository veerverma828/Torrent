/**
 * Production-Grade Trakt State Manager
 * Handles scrobble state machine and session management
 */

const PLAYBACK_STATES = {
  IDLE: 'idle',
  STARTING: 'starting',
  ACTIVE: 'active', 
  PAUSED: 'paused',
  STOPPING: 'stopping',
  COMPLETED: 'completed'
};

class TraktStateManager {
  constructor() {
    this.activeSessions = new Map(); // sessionKey -> sessionData
    this.stateTransitions = new Map(); // sessionKey -> Promise
  }

  /**
   * Generate unique session key
   */
  getSessionKey(metadata) {
    if (metadata.type === 'movie') {
      return `movie-${metadata.imdbId}`;
    }
    return `series-${metadata.imdbId}-${metadata.season}-${metadata.episode}`;
  }

  /**
   * Start playback session
   */
  async startPlayback(metadata, percentage = 0) {
    const sessionKey = this.getSessionKey(metadata);
    
    // Wait for existing transition if in progress
    if (this.stateTransitions.has(sessionKey)) {
      await this.stateTransitions.get(sessionKey);
    }

    const transitionPromise = this._executeStart(sessionKey, metadata, percentage);
    this.stateTransitions.set(sessionKey, transitionPromise);
    
    try {
      await transitionPromise;
    } finally {
      this.stateTransitions.delete(sessionKey);
    }
  }

  async _executeStart(sessionKey, metadata, percentage) {
    const session = this.activeSessions.get(sessionKey);
    
    // If session already active, just update progress
    if (session && session.state === PLAYBACK_STATES.ACTIVE) {
      await this.updateProgress(metadata, percentage);
      return;
    }

    // Set starting state
    this.activeSessions.set(sessionKey, {
      state: PLAYBACK_STATES.STARTING,
      metadata,
      startedAt: Date.now(),
      lastProgress: percentage
    });

    try {
      const { traktApi } = await import('./traktApi.js');
      const { buildPayload } = await import('../../trackers/providers/traktProvider.js');
      
      await traktApi.request('/scrobble/start', {
        method: 'POST',
        body: JSON.stringify(buildPayload(metadata, percentage))
      });

      // Update to active state
      this.activeSessions.set(sessionKey, {
        state: PLAYBACK_STATES.ACTIVE,
        metadata,
        startedAt: Date.now(),
        lastProgress: percentage,
        lastSync: Date.now()
      });

      console.log(`[TraktState] Started session: ${sessionKey}`);
    } catch (error) {
      this.activeSessions.delete(sessionKey);
      throw error;
    }
  }

  /**
   * Update playback progress
   */
  async updateProgress(metadata, percentage) {
    const sessionKey = this.getSessionKey(metadata);
    const session = this.activeSessions.get(sessionKey);

    if (!session || session.state !== PLAYBACK_STATES.ACTIVE) {
      // Try to start session if not active
      await this.startPlayback(metadata, percentage);
      return;
    }

    // Debounce rapid progress updates
    const now = Date.now();
    if (now - session.lastSync < 5000 && Math.abs(percentage - session.lastProgress) < 5) {
      return;
    }

    session.lastProgress = percentage;
    session.lastSync = now;

    try {
      const { traktApi } = await import('./traktApi.js');
      const { buildPayload } = await import('../../trackers/providers/traktProvider.js');
      
      await traktApi.request('/scrobble/pause', {
        method: 'POST',
        body: JSON.stringify(buildPayload(metadata, percentage))
      });

      console.log(`[TraktState] Updated progress: ${sessionKey} (${percentage}%)`);
    } catch (error) {
      console.error(`[TraktState] Failed to update progress: ${sessionKey}`, error);
      // Don't delete session on progress update failure
    }
  }

  /**
   * Stop playback session
   */
  async stopPlayback(metadata, percentage = 100) {
    const sessionKey = this.getSessionKey(metadata);
    
    // Wait for existing transition if in progress
    if (this.stateTransitions.has(sessionKey)) {
      await this.stateTransitions.get(sessionKey);
    }

    const transitionPromise = this._executeStop(sessionKey, metadata, percentage);
    this.stateTransitions.set(sessionKey, transitionPromise);
    
    try {
      await transitionPromise;
    } finally {
      this.stateTransitions.delete(sessionKey);
    }
  }

  async _executeStop(sessionKey, metadata, percentage) {
    const session = this.activeSessions.get(sessionKey);
    
    if (!session) {
      // No active session to stop
      return;
    }

    // Set stopping state
    session.state = PLAYBACK_STATES.STOPPING;

    try {
      const { traktApi } = await import('./traktApi.js');
      const { buildPayload } = await import('../../trackers/providers/traktProvider.js');
      
      await traktApi.request('/scrobble/stop', {
        method: 'POST',
        body: JSON.stringify(buildPayload(metadata, percentage))
      });

      // Mark as completed
      session.state = percentage >= 90 ? PLAYBACK_STATES.COMPLETED : PLAYBACK_STATES.IDLE;
      session.stoppedAt = Date.now();

      // Remove from active sessions after delay
      setTimeout(() => {
        this.activeSessions.delete(sessionKey);
      }, 5000);

      console.log(`[TraktState] Stopped session: ${sessionKey} (${percentage}%)`);
    } catch (error) {
      console.error(`[TraktState] Failed to stop session: ${sessionKey}`, error);
      // Keep session in active map for retry
      session.state = PLAYBACK_STATES.ACTIVE;
    }
  }

  /**
   * Get active session info
   */
  getSession(sessionKey) {
    return this.activeSessions.get(sessionKey);
  }

  /**
   * Get all active sessions
   */
  getAllSessions() {
    return Array.from(this.activeSessions.entries()).map(([key, session]) => ({
      sessionKey: key,
      ...session
    }));
  }

  /**
   * Cleanup old sessions
   */
  cleanup() {
    const now = Date.now();
    const timeout = 30 * 60 * 1000; // 30 minutes

    for (const [sessionKey, session] of this.activeSessions.entries()) {
      if (now - session.startedAt > timeout && session.state !== PLAYBACK_STATES.ACTIVE) {
        this.activeSessions.delete(sessionKey);
        console.log(`[TraktState] Cleaned up old session: ${sessionKey}`);
      }
    }
  }
}

export const traktStateManager = new TraktStateManager();

// Auto-cleanup every 10 minutes
setInterval(() => traktStateManager.cleanup(), 10 * 60 * 1000);
