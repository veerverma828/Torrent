/**
 * Offline-First Sync Queue Service
 * Manages queued Trakt operations with retry logic and network monitoring
 */

const STORAGE_KEYS = {
  SYNC_QUEUE: 'trakt_sync_queue',
  SYNC_STATUS: 'trakt_sync_status',
  LAST_SYNC: 'trakt_last_sync',
  FAILED_ATTEMPTS: 'trakt_failed_attempts'
};

const MAX_RETRY_ATTEMPTS = 5;
const BASE_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 60000; // 1 minute
const SYNC_DEBOUNCE_TIME = 5000; // 5 seconds

class SyncQueueService {
  constructor() {
    this.isOnline = navigator.onLine;
    this.isProcessing = false;
    this.syncTimeouts = new Map();
    this.failedAttempts = new Map();
    
    // Monitor network status
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  /**
   * Add an operation to the sync queue
   */
  enqueue(operation) {
    const queue = this.getQueue();
    const operationWithId = {
      id: this.generateOperationId(),
      timestamp: Date.now(),
      ...operation
    };

    // Remove existing operations for the same content to prevent duplicates
    const filteredQueue = queue.filter(op => 
      !(op.type === operation.type && 
        op.metadata.imdbId === operation.metadata.imdbId &&
        op.metadata.season === operation.metadata.season &&
        op.metadata.episode === operation.metadata.episode)
    );

    filteredQueue.push(operationWithId);
    this.saveQueue(filteredQueue);

    // Attempt to process immediately if online
    if (this.isOnline && !this.isProcessing) {
      this.processQueue();
    }

    return operationWithId.id;
  }

  /**
   * Process the sync queue
   */
  async processQueue() {
    if (!this.isOnline || this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    const queue = this.getQueue();
    
    if (queue.length === 0) {
      this.isProcessing = false;
      return;
    }

    console.log(`[SyncQueue] Processing ${queue.length} queued operations`);

    // Process operations in order
    for (const operation of queue) {
      try {
        await this.processOperation(operation);
        // Remove successful operation from queue
        this.removeOperation(operation.id);
      } catch (error) {
        console.error(`[SyncQueue] Failed to process operation ${operation.id}:`, error);
        await this.handleFailedOperation(operation, error);
      }
    }

    this.isProcessing = false;
    this.updateLastSync();
  }

  /**
   * Process a single operation
   */
  async processOperation(operation) {
    const { traktApi } = await import('../services/trakt/traktApi.js');
    
    switch (operation.action) {
      case 'startPlayback':
        await traktApi.request('/scrobble/start', {
          method: 'POST',
          body: JSON.stringify(operation.payload)
        });
        break;
        
      case 'stopPlayback':
        await traktApi.request('/scrobble/stop', {
          method: 'POST',
          body: JSON.stringify(operation.payload)
        });
        break;
        
      case 'syncProgress':
        await traktApi.request('/scrobble/pause', {
          method: 'POST',
          body: JSON.stringify(operation.payload)
        });
        break;
        
      case 'removeProgress':
        await traktApi.request(`/sync/playback/${operation.playbackId}`, {
          method: 'DELETE'
        });
        break;
        
      default:
        throw new Error(`Unknown operation: ${operation.action}`);
    }
  }

  /**
   * Handle failed operations with retry logic
   */
  async handleFailedOperation(operation, error) {
    const operationKey = this.getOperationKey(operation);
    const attempts = this.failedAttempts.get(operationKey) || 0;
    
    if (attempts >= MAX_RETRY_ATTEMPTS) {
      console.error(`[SyncQueue] Max retries exceeded for operation ${operation.id}, removing from queue`);
      this.removeOperation(operation.id);
      this.failedAttempts.delete(operationKey);
      return;
    }

    // Calculate exponential backoff delay
    const delay = Math.min(
      BASE_RETRY_DELAY * Math.pow(2, attempts),
      MAX_RETRY_DELAY
    );

    // Update failed attempts
    this.failedAttempts.set(operationKey, attempts + 1);
    
    // Schedule retry
    setTimeout(() => {
      if (this.isOnline) {
        this.processQueue();
      }
    }, delay);

    console.log(`[SyncQueue] Scheduling retry ${attempts + 1}/${MAX_RETRY_ATTEMPTS} for operation ${operation.id} in ${delay}ms`);
  }

  /**
   * Debounced sync for progress updates
   */
  debouncedSync(operation, debounceTime = SYNC_DEBOUNCE_TIME) {
    const operationKey = this.getOperationKey(operation);
    
    // Clear existing timeout for this operation
    if (this.syncTimeouts.has(operationKey)) {
      clearTimeout(this.syncTimeouts.get(operationKey));
    }

    // Set new timeout
    const timeoutId = setTimeout(() => {
      this.enqueue(operation);
      this.syncTimeouts.delete(operationKey);
    }, debounceTime);

    this.syncTimeouts.set(operationKey, timeoutId);
  }

  /**
   * Get current queue
   */
  getQueue() {
    try {
      const queue = localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
      return queue ? JSON.parse(queue) : [];
    } catch (error) {
      console.error('[SyncQueue] Failed to parse queue:', error);
      return [];
    }
  }

  /**
   * Save queue to storage
   */
  saveQueue(queue) {
    try {
      localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
    } catch (error) {
      console.error('[SyncQueue] Failed to save queue:', error);
    }
  }

  /**
   * Remove operation from queue
   */
  removeOperation(operationId) {
    const queue = this.getQueue();
    const filteredQueue = queue.filter(op => op.id !== operationId);
    this.saveQueue(filteredQueue);
  }

  /**
   * Generate unique operation ID
   */
  generateOperationId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get operation key for deduplication
   */
  getOperationKey(operation) {
    if (operation.metadata.type === 'movie') {
      return `movie-${operation.metadata.imdbId}`;
    } else {
      return `series-${operation.metadata.imdbId}-${operation.metadata.season}-${operation.metadata.episode}`;
    }
  }

  /**
   * Update last sync timestamp
   */
  updateLastSync() {
    try {
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
    } catch (error) {
      console.error('[SyncQueue] Failed to update last sync:', error);
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    const queue = this.getQueue();
    const lastSync = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    
    return {
      isOnline: this.isOnline,
      isProcessing: this.isProcessing,
      queueLength: queue.length,
      lastSync: lastSync ? parseInt(lastSync) : null,
      hasFailedOperations: Array.from(this.failedAttempts.values()).some(attempts => attempts > 0)
    };
  }

  /**
   * Clear all failed attempts (useful for manual retry)
   */
  clearFailedAttempts() {
    this.failedAttempts.clear();
  }

  /**
   * Force retry all queued operations
   */
  async retryAll() {
    this.clearFailedAttempts();
    await this.processQueue();
  }

  /**
   * Clear the entire queue (use with caution)
   */
  clearQueue() {
    this.saveQueue([]);
    this.clearFailedAttempts();
    this.syncTimeouts.forEach(timeout => clearTimeout(timeout));
    this.syncTimeouts.clear();
  }
}

export const syncQueueService = new SyncQueueService();
