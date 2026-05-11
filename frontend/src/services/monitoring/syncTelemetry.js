/**
 * Production-Grade Sync Telemetry and Monitoring
 * Tracks sync performance, errors, and user behavior analytics
 */

class SyncTelemetry {
  constructor() {
    this.metrics = {
      syncOperations: {
        total: 0,
        successful: 0,
        failed: 0,
        retried: 0
      },
      playbackEvents: {
        playEvents: 0,
        pauseEvents: 0,
        seekEvents: 0,
        completedItems: 0
      },
      performance: {
        averageSyncTime: 0,
        slowOperations: [],
        failedOperations: []
      },
      errors: {
        networkErrors: 0,
        rateLimitErrors: 0,
        authenticationErrors: 0,
        validationErrors: 0
      },
      userBehavior: {
        sessionsPerDay: 0,
        averageWatchTime: 0,
        completionRate: 0,
        deviceTypes: {}
      }
    };
    
    this.sessionStartTime = Date.now();
    this.currentSession = {
      id: this.generateSessionId(),
      startTime: this.sessionStartTime,
      events: []
    };
    
    this.initializeTelemetry();
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  initializeTelemetry() {
    // Load persisted metrics
    this.loadPersistedMetrics();
    
    // Setup periodic reporting
    setInterval(() => this.reportMetrics(), 5 * 60 * 1000); // Every 5 minutes
    
    // Report on page unload
    window.addEventListener('beforeunload', () => this.reportMetrics(true));
    
    // Track device type
    this.trackDeviceType();
  }

  trackSyncOperation(operation, success, duration, error = null) {
    const timestamp = Date.now();
    
    // Update basic metrics
    this.metrics.syncOperations.total++;
    
    if (success) {
      this.metrics.syncOperations.successful++;
    } else {
      this.metrics.syncOperations.failed++;
      this.trackError(error, operation);
    }
    
    // Track performance
    if (duration > 5000) { // > 5 seconds is slow
      this.metrics.performance.slowOperations.push({
        operation: operation.action,
        duration,
        timestamp,
        metadata: operation.metadata?.title || 'unknown'
      });
    }
    
    // Update average sync time
    this.updateAverageSyncTime(duration);
    
    // Log to current session
    this.currentSession.events.push({
      type: 'sync',
      operation: operation.action,
      success,
      duration,
      timestamp,
      metadata: {
        title: operation.metadata?.title,
        type: operation.metadata?.type,
        error: error?.message
      }
    });
    
    console.log(`[Telemetry] Sync ${operation.action}: ${success ? 'SUCCESS' : 'FAILED'} (${duration}ms)`);
  }

  trackPlaybackEvent(eventType, metadata, additionalData = {}) {
    const timestamp = Date.now();
    
    // Update playback metrics
    switch (eventType) {
      case 'play':
        this.metrics.playbackEvents.playEvents++;
        break;
      case 'pause':
        this.metrics.playbackEvents.pauseEvents++;
        break;
      case 'seek':
        this.metrics.playbackEvents.seekEvents++;
        break;
      case 'completed':
        this.metrics.playbackEvents.completedItems++;
        this.updateCompletionRate();
        break;
    }
    
    // Log to current session
    this.currentSession.events.push({
      type: 'playback',
      eventType,
      timestamp,
      metadata: {
        title: metadata.title,
        type: metadata.type,
        ...additionalData
      }
    });
    
    console.log(`[Telemetry] Playback event: ${eventType} for ${metadata.title}`);
  }

  trackError(error, context = {}) {
    const timestamp = Date.now();
    
    if (!error) return;
    
    // Categorize error
    if (error.message?.includes('network') || error.message?.includes('fetch')) {
      this.metrics.errors.networkErrors++;
    } else if (error.message?.includes('429') || error.message?.includes('rate limit')) {
      this.metrics.errors.rateLimitErrors++;
    } else if (error.message?.includes('401') || error.message?.includes('authentication')) {
      this.metrics.errors.authenticationErrors++;
    } else if (error.message?.includes('validation') || error.message?.includes('400')) {
      this.metrics.errors.validationErrors++;
    }
    
    // Track failed operation details
    this.metrics.performance.failedOperations.push({
      timestamp,
      error: error.message,
      context: context.action || 'unknown',
      metadata: context.metadata?.title || 'unknown'
    });
    
    console.error(`[Telemetry] Error tracked: ${error.message}`, context);
  }

  trackUserBehavior(action, data = {}) {
    switch (action) {
      case 'watch_time':
        this.metrics.userBehavior.averageWatchTime = 
          (this.metrics.userBehavior.averageWatchTime + data.watchTime) / 2;
        break;
      case 'session_start':
        this.metrics.userBehavior.sessionsPerDay++;
        break;
    }
  }

  trackDeviceType() {
    const userAgent = navigator.userAgent;
    let deviceType = 'desktop';
    
    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
      deviceType = /iPad/.test(userAgent) ? 'tablet' : 'mobile';
    }
    
    this.metrics.userBehavior.deviceTypes[deviceType] = 
      (this.metrics.userBehavior.deviceTypes[deviceType] || 0) + 1;
  }

  updateAverageSyncTime(duration) {
    const total = this.metrics.performance.averageSyncTime * (this.metrics.syncOperations.total - 1) + duration;
    this.metrics.performance.averageSyncTime = total / this.metrics.syncOperations.total;
  }

  updateCompletionRate() {
    const total = this.metrics.playbackEvents.playEvents;
    const completed = this.metrics.playbackEvents.completedItems;
    this.metrics.userBehavior.completionRate = total > 0 ? (completed / total) * 100 : 0;
  }

  getHealthStatus() {
    const successRate = this.metrics.syncOperations.total > 0 
      ? (this.metrics.syncOperations.successful / this.metrics.syncOperations.total) * 100 
      : 100;
    
    const errorRate = this.metrics.syncOperations.total > 0
      ? (this.metrics.syncOperations.failed / this.metrics.syncOperations.total) * 100
      : 0;
    
    let status = 'healthy';
    if (successRate < 90) status = 'degraded';
    if (successRate < 75) status = 'critical';
    
    return {
      status,
      successRate: Math.round(successRate),
      errorRate: Math.round(errorRate),
      averageSyncTime: Math.round(this.metrics.performance.averageSyncTime),
      activeSession: {
        id: this.currentSession.id,
        duration: Date.now() - this.currentSession.startTime,
        eventCount: this.currentSession.events.length
      }
    };
  }

  getDetailedReport() {
    return {
      session: this.currentSession,
      metrics: this.metrics,
      health: this.getHealthStatus(),
      recommendations: this.generateRecommendations()
    };
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Check sync success rate
    const successRate = this.metrics.syncOperations.total > 0 
      ? (this.metrics.syncOperations.successful / this.metrics.syncOperations.total) * 100 
      : 100;
    
    if (successRate < 90) {
      recommendations.push({
        type: 'sync_reliability',
        severity: 'warning',
        message: 'Sync success rate is below 90%. Check network connectivity and Trakt API status.',
        action: 'investigate_network'
      });
    }
    
    // Check for slow operations
    if (this.metrics.performance.slowOperations.length > 5) {
      recommendations.push({
        type: 'performance',
        severity: 'warning',
        message: 'Multiple slow sync operations detected. Consider optimizing sync frequency.',
        action: 'optimize_sync'
      });
    }
    
    // Check rate limiting
    if (this.metrics.errors.rateLimitErrors > 3) {
      recommendations.push({
        type: 'rate_limit',
        severity: 'error',
        message: 'Frequent rate limiting detected. Reduce API call frequency.',
        action: 'reduce_frequency'
      });
    }
    
    // Check completion rate
    if (this.metrics.userBehavior.completionRate < 50) {
      recommendations.push({
        type: 'engagement',
        severity: 'info',
        message: 'Low completion rate detected. Users may be experiencing playback issues.',
        action: 'improve_playback'
      });
    }
    
    return recommendations;
  }

  reportMetrics(isFinal = false) {
    const report = this.getDetailedReport();
    
    console.log(`[Telemetry] ${isFinal ? 'Final' : 'Periodic'} Report:`, report);
    
    // In production, send to analytics service
    if (isFinal) {
      this.persistMetrics();
    }
  }

  persistMetrics() {
    try {
      const persistData = {
        metrics: this.metrics,
        session: this.currentSession,
        timestamp: Date.now()
      };
      
      localStorage.setItem('trakt_telemetry_metrics', JSON.stringify(persistData));
    } catch (error) {
      console.error('[Telemetry] Failed to persist metrics:', error);
    }
  }

  loadPersistedMetrics() {
    try {
      const stored = localStorage.getItem('trakt_telemetry_metrics');
      if (stored) {
        const data = JSON.parse(stored);
        // Merge with current metrics (keep recent data)
        if (data.metrics) {
          this.metrics = { ...this.metrics, ...data.metrics };
        }
      }
    } catch (error) {
      console.error('[Telemetry] Failed to load persisted metrics:', error);
    }
  }

  resetMetrics() {
    this.metrics = {
      syncOperations: { total: 0, successful: 0, failed: 0, retried: 0 },
      playbackEvents: { playEvents: 0, pauseEvents: 0, seekEvents: 0, completedItems: 0 },
      performance: { averageSyncTime: 0, slowOperations: [], failedOperations: [] },
      errors: { networkErrors: 0, rateLimitErrors: 0, authenticationErrors: 0, validationErrors: 0 },
      userBehavior: { sessionsPerDay: 0, averageWatchTime: 0, completionRate: 0, deviceTypes: new Map() }
    };
    
    localStorage.removeItem('trakt_telemetry_metrics');
  }

  // Export for debugging
  exportDebugData() {
    return {
      currentSession: this.currentSession,
      metrics: this.metrics,
      health: this.getHealthStatus(),
      userAgent: navigator.userAgent,
      timestamp: Date.now()
    };
  }
}

export const syncTelemetry = new SyncTelemetry();
