/**
 * Trakt Sync Queue — the sole durable push queue from local progress to
 * Trakt. Handles operations with exponential backoff, rate limiting, and
 * conflict resolution.
 */

import { traktProvider } from "../../trackers/providers/traktProvider.js";
import { syncHealthMonitor } from "../monitoring/syncHealthMonitor.js";
import { syncTelemetry } from "../monitoring/syncTelemetry.js";

const STORAGE_KEYS = {
  SYNC_QUEUE: 'trakt_sync_queue',
  SYNC_STATUS: 'trakt_sync_status',
  LAST_SYNC: 'trakt_last_sync',
  FAILED_ATTEMPTS: 'trakt_failed_attempts',
  RATE_LIMIT_RESET: 'trakt_rate_limit_reset',
  CONFLICT_RESOLUTION: 'trakt_conflict_resolution'
};

const MAX_RETRY_ATTEMPTS = 8;
const BASE_RETRY_DELAY = 2000; // 2 seconds
const MAX_RETRY_DELAY = 300000; // 5 minutes
const SYNC_DEBOUNCE_TIME = 8000; // 8 seconds
const RATE_LIMIT_DELAY = 60000; // 1 minute for 429 errors
const CONCURRENT_OPERATIONS = 3; // Max concurrent sync operations

class TraktSyncQueue {
  constructor() {
    this.isOnline = navigator.onLine;
    this.isProcessing = false;
    this.activeOperations = new Set();
    this.syncTimeouts = new Map();
    this.failedAttempts = new Map();
    this.rateLimitReset = 0;
    this.operationQueue = [];
    this.conflictResolver = new ConflictResolver();
    // Prevents double-firing /scrobble/start for the same session within a
    // single processing pass (e.g. rapid play/pause toggling).
    this.pendingStarts = new Set();
    
    this.initializeEventListeners();
    this.loadPersistedState();
    
    syncHealthMonitor.setSyncQueueStatusProvider(() => this.getSyncStatus());

    // Start health monitoring
    syncHealthMonitor.startMonitoring();
  }

  initializeEventListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Process queue on page visibility change (user returns to tab)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isOnline) {
        this.processQueue();
      }
    });
  }

  loadPersistedState() {
    try {
      const rateLimitReset = localStorage.getItem(STORAGE_KEYS.RATE_LIMIT_RESET);
      if (rateLimitReset) {
        this.rateLimitReset = parseInt(rateLimitReset);
      }
    } catch (error) {
      console.error('[SyncQueue] Failed to load persisted state:', error);
    }
  }

  /**
   * Add operation to queue with intelligent deduplication
   */
  enqueue(operation) {
    const queue = this.getQueue();
    const operationWithId = {
      id: this.generateOperationId(),
      timestamp: Date.now(),
      priority: this.getOperationPriority(operation),
      ...operation
    };

    // Remove conflicting operations for the same content
    const filteredQueue = this.removeConflictingOperations(queue, operationWithId);
    
    filteredQueue.push(operationWithId);
    filteredQueue.sort((a, b) => b.priority - a.priority);
    
    this.saveQueue(filteredQueue);

    // Process immediately if conditions allow
    if (this.canProcessOperation()) {
      this.processQueue();
    }

    return operationWithId.id;
  }

  /**
   * Debounced sync with intelligent merging
   */
  debouncedSync(operation, debounceTime = SYNC_DEBOUNCE_TIME) {
    const operationKey = this.getOperationKey(operation);
    
    // Clear existing timeout for this operation
    if (this.syncTimeouts.has(operationKey)) {
      clearTimeout(this.syncTimeouts.get(operationKey));
    }

    // Merge with existing queued operation if present
    const queue = this.getQueue();
    const existingIndex = queue.findIndex(op => this.getOperationKey(op) === operationKey);
    
    if (existingIndex >= 0) {
      // Merge operations (prefer latest data)
      queue[existingIndex] = this.mergeOperations(queue[existingIndex], operation);
      this.saveQueue(queue);
    }

    // Set new timeout
    const timeoutId = setTimeout(() => {
      this.enqueue(operation);
      this.syncTimeouts.delete(operationKey);
    }, debounceTime);

    this.syncTimeouts.set(operationKey, timeoutId);
  }

  /**
   * Process queue with concurrency control
   */
  async processQueue() {
    if (!this.canProcessOperation() || this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    const queue = this.getQueue();
    
    if (queue.length === 0) {
      this.isProcessing = false;
      return;
    }

    console.log(`[SyncQueue] Processing ${queue.length} operations`);

    // Process operations in batches with concurrency control
    const batch = queue.splice(0, CONCURRENT_OPERATIONS);
    const promises = batch.map(operation => this.processOperation(operation));

    try {
      await Promise.allSettled(promises);
    } catch (error) {
      console.error('[SyncQueue] Batch processing error:', error);
    }

    this.saveQueue(queue);
    this.isProcessing = false;

    // Continue processing if more items exist
    if (queue.length > 0) {
      setTimeout(() => this.processQueue(), 1000);
    } else {
      this.updateLastSync();
    }
  }

  /**
   * Process single operation with comprehensive error handling
   */
  async processOperation(operation) {
    if (this.activeOperations.has(operation.id)) {
      return; // Already processing
    }

    this.activeOperations.add(operation.id);
    const startTime = Date.now();
    let success = false;
    let error = null;

    try {
      // Check rate limiting
      if (this.isRateLimited()) {
        throw new Error('Rate limited');
      }

      await this.executeOperation(operation);
      this.removeOperation(operation.id);
      this.clearFailedAttempts(operation);
      
      success = true;
      console.log(`[SyncQueue] Success: ${operation.action} for ${operation.metadata?.title || 'unknown'}`);
    } catch (err) {
      error = err;
      console.error(`[SyncQueue] Failed: ${operation.action} for ${operation.metadata?.title || 'unknown'}`, err);
      await this.handleFailedOperation(operation, err);
    } finally {
      // Track telemetry
      const duration = Date.now() - startTime;
      syncTelemetry.trackSyncOperation(operation, success, duration, error);
      
      this.activeOperations.delete(operation.id);
    }
  }

  /**
   * Dispatches a queued operation to the actual Trakt API call it represents.
   */
  async executeOperation(operation) {
    const { action, metadata } = operation;
    const sessionKey = metadata ? this.getOperationKey(operation) : null;

    switch (action) {
      case 'startPlayback': {
        if (sessionKey && this.pendingStarts.has(sessionKey)) return;
        if (sessionKey) this.pendingStarts.add(sessionKey);
        await traktProvider.startPlayback(metadata, operation.percentage);
        return;
      }
      case 'stopPlayback': {
        if (sessionKey) this.pendingStarts.delete(sessionKey);
        await traktProvider.stopPlayback(metadata, operation.percentage);
        return;
      }
      case 'syncProgress': {
        if (metadata.type === 'movie') {
          await traktProvider.syncMovieProgress(metadata, null, operation.percentage);
        } else {
          await traktProvider.syncEpisodeProgress(metadata, operation.percentage);
        }
        return;
      }
      case 'removeProgress': {
        await traktProvider.removeProgress(operation.type, operation.id);
        return;
      }
      case 'addToHistory': {
        await traktProvider.addToHistory({
          movies: operation.movies || [],
          episodes: operation.episodes || [],
        });
        return;
      }
      default:
        throw new Error(`Unknown sync operation action: ${action}`);
    }
  }

  /**
   * Advanced failure handling with exponential backoff
   */
  async handleFailedOperation(operation, error) {
    const operationKey = this.getOperationKey(operation);
    const attempts = this.failedAttempts.get(operationKey) || 0;
    
    // Handle rate limiting specially
    if (error.message.includes('429') || error.message.includes('Rate limited')) {
      this.rateLimitReset = Date.now() + RATE_LIMIT_DELAY;
      localStorage.setItem(STORAGE_KEYS.RATE_LIMIT_RESET, this.rateLimitReset.toString());
      return;
    }

    // Max retries exceeded
    if (attempts >= MAX_RETRY_ATTEMPTS) {
      console.error(`[SyncQueue] Max retries exceeded for ${operation.id}, removing`);
      this.removeOperation(operation.id);
      this.failedAttempts.delete(operationKey);
      return;
    }

    // Calculate exponential backoff with jitter
    const baseDelay = Math.min(BASE_RETRY_DELAY * Math.pow(2, attempts), MAX_RETRY_DELAY);
    const jitter = Math.random() * 0.3 * baseDelay; // 30% jitter
    const delay = baseDelay + jitter;

    // Update failed attempts
    this.failedAttempts.set(operationKey, attempts + 1);
    
    // Schedule retry
    setTimeout(() => {
      if (this.canProcessOperation()) {
        this.processQueue();
      }
    }, delay);

    console.log(`[SyncQueue] Retry ${attempts + 1}/${MAX_RETRY_ATTEMPTS} for ${operation.id} in ${Math.round(delay)}ms`);
  }

  /**
   * Conflict resolution for operations
   */
  removeConflictingOperations(queue, newOperation) {
    return queue.filter(op => {
      // Same content but different action - resolve using conflict resolver
      if (this.getOperationKey(op) === this.getOperationKey(newOperation)) {
        return this.conflictResolver.shouldKeep(op, newOperation);
      }
      return true;
    });
  }

  mergeOperations(existing, incoming) {
    return this.conflictResolver.merge(existing, incoming);
  }

  getOperationPriority(operation) {
    const priorities = {
      'startPlayback': 100,
      'stopPlayback': 90,
      'syncProgress': 50,
      'removeProgress': 30,
      'addToHistory': 20
    };
    return priorities[operation.action] || 10;
  }

  getOperationKey(operation) {
    if (operation.metadata?.type === 'movie') {
      return `movie-${operation.metadata.imdbId}`;
    } else if (operation.metadata?.type === 'series') {
      return `series-${operation.metadata.imdbId}-${operation.metadata.season}-${operation.metadata.episode}`;
    }
    return `${operation.action}-${operation.id}`;
  }

  canProcessOperation() {
    return this.isOnline && !this.isRateLimited() && this.activeOperations.size < CONCURRENT_OPERATIONS;
  }

  isRateLimited() {
    return Date.now() < this.rateLimitReset;
  }

  generateOperationId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Storage methods
  getQueue() {
    try {
      const queue = localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
      return queue ? JSON.parse(queue) : [];
    } catch (error) {
      console.error('[SyncQueue] Failed to parse queue:', error);
      return [];
    }
  }

  saveQueue(queue) {
    try {
      localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
    } catch (error) {
      console.error('[SyncQueue] Failed to save queue:', error);
    }
  }

  removeOperation(operationId) {
    const queue = this.getQueue();
    const filteredQueue = queue.filter(op => op.id !== operationId);
    this.saveQueue(filteredQueue);
  }

  clearFailedAttempts(operation) {
    const operationKey = this.getOperationKey(operation);
    this.failedAttempts.delete(operationKey);
  }

  updateLastSync() {
    try {
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
    } catch (error) {
      console.error('[SyncQueue] Failed to update last sync:', error);
    }
  }

  getSyncStatus() {
    const queue = this.getQueue();
    const lastSync = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    
    return {
      isOnline: this.isOnline,
      isProcessing: this.isProcessing,
      queueLength: queue.length,
      activeOperations: this.activeOperations.size,
      lastSync: lastSync ? parseInt(lastSync) : null,
      isRateLimited: this.isRateLimited(),
      rateLimitReset: this.rateLimitReset,
      hasFailedOperations: Array.from(this.failedAttempts.values()).some(attempts => attempts > 0)
    };
  }

  async retryAll() {
    this.failedAttempts.clear();
    this.rateLimitReset = 0;
    localStorage.removeItem(STORAGE_KEYS.RATE_LIMIT_RESET);
    await this.processQueue();
  }

  clearQueue() {
    this.saveQueue([]);
    this.failedAttempts.clear();
    this.syncTimeouts.forEach(timeout => clearTimeout(timeout));
    this.syncTimeouts.clear();
  }
}

/**
 * Conflict Resolution Strategy
 */
class ConflictResolver {
  shouldKeep(existing, incoming) {
    // Action priority hierarchy
    const actionPriority = {
      'stopPlayback': 4,
      'startPlayback': 3,
      'syncProgress': 2,
      'removeProgress': 1
    };

    const existingPriority = actionPriority[existing.action] || 0;
    const incomingPriority = actionPriority[incoming.action] || 0;

    // Keep higher priority action, or newer timestamp if equal
    if (incomingPriority > existingPriority) {
      return false; // Replace existing
    } else if (incomingPriority === existingPriority) {
      return incoming.timestamp > existing.timestamp; // Keep newer
    }

    return true; // Keep existing
  }

  merge(existing, incoming) {
    // For progress operations, merge the data
    if (existing.action === 'syncProgress' && incoming.action === 'syncProgress') {
      return {
        ...existing,
        percentage: Math.max(existing.percentage || 0, incoming.percentage || 0),
        timestamp: Math.max(existing.timestamp, incoming.timestamp)
      };
    }

    // Otherwise, return the newer operation
    return incoming.timestamp > existing.timestamp ? incoming : existing;
  }
}

export const traktSyncQueue = new TraktSyncQueue();
