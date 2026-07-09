/**
 * Orchestration façade over the local progress store. Every read comes
 * straight from progressTracker (the single source of truth); Trakt mode
 * only adds a push to the sync queue alongside each local write. Pulling
 * Trakt's own state back down is traktReconciliation's job, not this
 * module's — reads here never branch on sync mode.
 */
import * as progressTracker from "./progressTracker.js";
import { traktSyncQueue } from "../services/trakt/traktSyncQueue.js";
import { isTraktSyncEnabled } from "../utils/syncMode.js";

export const progressService = {
  async getMovieProgress(id) {
    return progressTracker.getMovieProgress(id);
  },

  async getEpisodeProgress(seriesId, season, episode) {
    return progressTracker.getEpisodeProgress(seriesId, season, episode);
  },

  async getContinueWatching(limit) {
    return progressTracker.getContinueWatching(limit);
  },

  async getHistory(limit) {
    return progressTracker.getHistory(limit);
  },

  startPlayback(metadata, percentage) {
    if (!isTraktSyncEnabled()) return;

    traktSyncQueue.enqueue({
      action: "startPlayback",
      metadata,
      percentage,
    });
  },

  stopPlayback(metadata, percentage) {
    if (!isTraktSyncEnabled()) return;

    traktSyncQueue.enqueue({
      action: "stopPlayback",
      metadata,
      percentage,
    });
  },

  saveProgress(metadata, currentTime, duration) {
    // Always the local write — this is the source of truth regardless of mode.
    progressTracker.saveProgress(metadata, currentTime, duration);

    if (!isTraktSyncEnabled()) return;

    const safeDuration =
      duration && !Number.isNaN(duration) && duration !== Infinity ? duration : 0;
    const percentage = safeDuration > 0 ? (currentTime / safeDuration) * 100 : 0;

    traktSyncQueue.debouncedSync({
      action: "syncProgress",
      metadata,
      percentage,
    });
  },

  removeProgress(type, id) {
    progressTracker.removeProgress(type, id);

    if (!isTraktSyncEnabled()) return;

    traktSyncQueue.enqueue({
      action: "removeProgress",
      type,
      id,
    });
  },

  async getSyncStatus() {
    if (!isTraktSyncEnabled()) {
      return {
        isOnline: navigator.onLine,
        isProcessing: false,
        queueLength: 0,
        activeOperations: 0,
        lastSync: null,
        isRateLimited: false,
        rateLimitReset: 0,
        hasFailedOperations: false,
      };
    }

    return traktSyncQueue.getSyncStatus();
  },

  async retrySync() {
    if (!isTraktSyncEnabled()) return undefined;
    return traktSyncQueue.retryAll();
  },
};
