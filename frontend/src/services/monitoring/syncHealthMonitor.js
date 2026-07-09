/**
 * Production-Grade Sync Health Monitor
 * Real-time monitoring and alerting for sync system health
 */
import { getSyncMode } from "../../utils/syncMode.js";

class SyncHealthMonitor {
  constructor() {
    this.healthChecks = new Map();
    this.alerts = [];
    this.isMonitoring = false;
    this.checkInterval = 30000; // 30 seconds
    this.alertHistory = [];
    this.maxAlertHistory = 100;
    this.syncQueueStatusProvider = null;
    
    this.initializeHealthChecks();
  }

  setSyncQueueStatusProvider(provider) {
    this.syncQueueStatusProvider = provider;
  }

  initializeHealthChecks() {
    // Define health checks
    this.healthChecks.set('sync_queue', {
      name: 'Sync Queue',
      check: this.checkSyncQueue.bind(this),
      severity: 'high'
    });
    
    this.healthChecks.set('trakt_api', {
      name: 'Trakt API',
      check: this.checkTraktApi.bind(this),
      severity: 'critical'
    });
    
    this.healthChecks.set('local_storage', {
      name: 'Local Storage',
      check: this.checkLocalStorage.bind(this),
      severity: 'medium'
    });
    
    this.healthChecks.set('network_connectivity', {
      name: 'Network Connectivity',
      check: this.checkNetworkConnectivity.bind(this),
      severity: 'high'
    });
    
    this.healthChecks.set('authentication', {
      name: 'Trakt Authentication',
      check: this.checkAuthentication.bind(this),
      severity: 'critical'
    });
  }

  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log('[HealthMonitor] Starting health monitoring');
    
    // Run initial check
    this.runHealthChecks();
    
    // Schedule periodic checks
    this.monitoringInterval = setInterval(() => {
      this.runHealthChecks();
    }, this.checkInterval);
  }

  stopMonitoring() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    console.log('[HealthMonitor] Stopped health monitoring');
  }

  async runHealthChecks() {
    const results = new Map();
    
    for (const [key, healthCheck] of this.healthChecks) {
      try {
        const result = await healthCheck.check();
        results.set(key, {
          ...result,
          name: healthCheck.name,
          severity: healthCheck.severity,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error(`[HealthMonitor] Health check failed for ${key}:`, error);
        results.set(key, {
          status: 'error',
          message: `Health check failed: ${error.message}`,
          name: healthCheck.name,
          severity: healthCheck.severity,
          timestamp: Date.now()
        });
      }
    }
    
    this.processHealthResults(results);
    return results;
  }

  processHealthResults(results) {
    const previousAlerts = new Set(this.alerts.map(a => a.key));
    const currentAlerts = new Set();
    
    for (const [key, result] of results) {
      if (result.status !== 'healthy') {
        currentAlerts.add(key);
        
        // Check if this is a new alert
        if (!previousAlerts.has(key)) {
          this.createAlert(key, result);
        } else {
          // Update existing alert
          this.updateAlert(key, result);
        }
      } else {
        // Clear resolved alerts
        this.clearAlert(key);
      }
    }
  }

  createAlert(key, result) {
    const alert = {
      key,
      title: `${result.name} Issue`,
      message: result.message,
      severity: result.severity,
      status: result.status,
      timestamp: Date.now(),
      acknowledged: false,
      resolved: false
    };
    
    this.alerts.push(alert);
    this.alertHistory.push(alert);
    
    // Trim history
    if (this.alertHistory.length > this.maxAlertHistory) {
      this.alertHistory = this.alertHistory.slice(-this.maxAlertHistory);
    }
    
    console.warn(`[HealthMonitor] Alert created:`, alert);
    this.notifyAlert(alert);
  }

  updateAlert(key, result) {
    const alert = this.alerts.find(a => a.key === key);
    if (alert) {
      alert.message = result.message;
      alert.status = result.status;
      alert.timestamp = Date.now();
    }
  }

  clearAlert(key) {
    const alertIndex = this.alerts.findIndex(a => a.key === key);
    if (alertIndex >= 0) {
      const alert = this.alerts[alertIndex];
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      
      this.alerts.splice(alertIndex, 1);
      console.log(`[HealthMonitor] Alert resolved: ${alert.title}`);
    }
  }

  notifyAlert(alert) {
    // In production, send to monitoring service
    // For now, just console and potentially show UI notification
    
    if (alert.severity === 'critical') {
      console.error(`🚨 CRITICAL: ${alert.title} - ${alert.message}`);
    } else if (alert.severity === 'high') {
      console.warn(`⚠️ HIGH: ${alert.title} - ${alert.message}`);
    } else {
      console.info(`ℹ️ INFO: ${alert.title} - ${alert.message}`);
    }
  }

  // Health check implementations
  async checkSyncQueue() {
    try {
      if (!this.syncQueueStatusProvider) {
        return {
          status: 'healthy',
          message: 'Sync queue not initialized'
        };
      }

      const status = this.syncQueueStatusProvider();
      
      if (status.queueLength > 50) {
        return {
          status: 'warning',
          message: `Queue backlog: ${status.queueLength} items`
        };
      }
      
      if (status.hasFailedOperations) {
        return {
          status: 'warning',
          message: 'Failed operations detected in queue'
        };
      }
      
      if (status.isRateLimited) {
        return {
          status: 'critical',
          message: `Rate limited until ${new Date(status.rateLimitReset).toLocaleTimeString()}`
        };
      }
      
      return { status: 'healthy' };
    } catch (error) {
      return {
        status: 'error',
        message: `Queue check failed: ${error.message}`
      };
    }
  }

  async checkTraktApi() {
    try {
      // Only check Trakt API if sync mode is enabled and authenticated
      const accessToken = localStorage.getItem('trakt_access_token');

      if (getSyncMode() !== 'trakt' || !accessToken) {
        return {
          status: 'healthy',
          message: 'Trakt sync not enabled'
        };
      }
      
      const { traktApi } = await import('../trakt/traktApi.js');
      
      // Simple health check - get user profile
      await traktApi.request('/users/settings');
      
      return { status: 'healthy' };
    } catch (error) {
      if (error.message.includes('401') || error.message.includes('No Trakt access token')) {
        return {
          status: 'warning',
          message: 'Authentication required - please reconnect Trakt'
        };
      }
      
      if (error.message.includes('network') || error.message.includes('fetch')) {
        return {
          status: 'warning',
          message: 'Network connectivity issues'
        };
      }
      
      return {
        status: 'warning',
        message: `API check failed: ${error.message}`
      };
    }
  }

  async checkLocalStorage() {
    try {
      const testKey = 'health_check_test';
      const testValue = Date.now().toString();
      
      localStorage.setItem(testKey, testValue);
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      
      if (retrieved !== testValue) {
        return {
          status: 'critical',
          message: 'Local storage read/write failure'
        };
      }
      
      // Check storage quota
      const usage = JSON.stringify(localStorage).length;
      const quota = 5 * 1024 * 1024; // 5MB estimate
      const usagePercent = (usage / quota) * 100;
      
      if (usagePercent > 90) {
        return {
          status: 'warning',
          message: `Storage usage high: ${Math.round(usagePercent)}%`
        };
      }
      
      return { status: 'healthy' };
    } catch (error) {
      return {
        status: 'critical',
        message: `Local storage error: ${error.message}`
      };
    }
  }

  async checkNetworkConnectivity() {
    if (!navigator.onLine) {
      return {
        status: 'critical',
        message: 'Offline - no network connectivity'
      };
    }
    return { status: 'healthy' };
  }

  async checkAuthentication() {
    try {
      const token = localStorage.getItem('trakt_access_token');
      const expiresAt = localStorage.getItem('trakt_token_expires_at');

      // Only check authentication if Trakt sync mode is enabled
      if (getSyncMode() !== 'trakt') {
        return {
          status: 'healthy',
          message: 'Trakt sync not enabled'
        };
      }
      
      if (!token) {
        return {
          status: 'warning',
          message: 'No Trakt authentication token'
        };
      }
      
      if (expiresAt && Date.now() >= parseInt(expiresAt)) {
        return {
          status: 'critical',
          message: 'Trakt authentication token expired'
        };
      }
      
      const { traktAuth } = await import('../trakt/traktAuth.js');
      await traktAuth.ensureValidToken();
      
      return { status: 'healthy' };
    } catch (error) {
      return {
        status: 'warning',
        message: `Authentication check failed: ${error.message}`
      };
    }
  }

  // Public API
  getHealthStatus() {
    return {
      isMonitoring: this.isMonitoring,
      activeAlerts: this.alerts,
      alertCount: this.alerts.length,
      criticalAlerts: this.alerts.filter(a => a.severity === 'critical').length,
      lastCheck: this.lastHealthCheck
    };
  }

  acknowledgeAlert(key) {
    const alert = this.alerts.find(a => a.key === key);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = Date.now();
    }
  }

  getAlertHistory(limit = 50) {
    return this.alertHistory.slice(-limit);
  }

  async runSingleCheck(checkKey) {
    const healthCheck = this.healthChecks.get(checkKey);
    if (!healthCheck) {
      throw new Error(`Unknown health check: ${checkKey}`);
    }
    
    try {
      const result = await healthCheck.check();
      return {
        key: checkKey,
        ...result,
        name: healthCheck.name,
        severity: healthCheck.severity,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        key: checkKey,
        status: 'error',
        message: `Health check failed: ${error.message}`,
        name: healthCheck.name,
        severity: healthCheck.severity,
        timestamp: Date.now()
      };
    }
  }

  clearAllAlerts() {
    this.alerts = [];
    console.log('[HealthMonitor] All alerts cleared');
  }
}

export const syncHealthMonitor = new SyncHealthMonitor();
