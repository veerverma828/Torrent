import { localProvider } from "./providers/localProvider.js";
import { traktProvider } from "./providers/traktProvider.js";
import { productionSyncQueue } from "../services/sync/productionSyncQueue.js";
import { traktStateManager } from "../services/trakt/traktStateManager.js";
import { continueWatchingAggregator } from "../services/sync/continueWatchingAggregator.js";

const getSyncMode = () => {
  return localStorage.getItem("syncMode") || "local";
};

const getProvider = () => {
  return getSyncMode() === "trakt" ? traktProvider : localProvider;
};

export const progressService = {
  provider() {
    return getProvider();
  },

  async getMovieProgress(...args) {
    // Always try local first for instant response
    const localResult = localProvider.getMovieProgress(...args);
    
    // If Trakt mode, fetch remote data in background
    if (getSyncMode() === "trakt") {
      traktProvider.getMovieProgress(...args).then(traktResult => {
        if (traktResult && (!localResult || traktResult.updatedAt > localResult.lastUpdated)) {
          // Update local cache with newer Trakt data
          this.updateLocalProgress('movie', args[0], traktResult);
        }
      }).catch(() => {
        // Silently fail - local data remains primary
      });
    }
    
    return localResult;
  },

  async getEpisodeProgress(...args) {
    // Always try local first for instant response
    const localResult = localProvider.getEpisodeProgress(...args);
    
    // If Trakt mode, fetch remote data in background
    if (getSyncMode() === "trakt") {
      traktProvider.getEpisodeProgress(...args).then(traktResult => {
        if (traktResult && (!localResult || traktResult.updatedAt > localResult.lastUpdated)) {
          // Update local cache with newer Trakt data
          this.updateLocalProgress('episode', args[0], traktResult, args[1], args[2]);
        }
      }).catch(() => {
        // Silently fail - local data remains primary
      });
    }
    
    return localResult;
  },

  async getContinueWatching(...args) {
    return continueWatchingAggregator.getContinueWatching();
  },

  startPlayback(metadata, percentage) {
    // Always start local playback immediately
    localProvider.startPlayback?.(metadata, percentage);
    
    // Queue Trakt sync if enabled using production queue
    if (getSyncMode() === "trakt") {
      productionSyncQueue.enqueue({
        action: 'startPlayback',
        metadata,
        percentage
      });
    }
  },

  stopPlayback(metadata, percentage) {
    // Always stop local playback immediately
    localProvider.stopPlayback?.(metadata, percentage);
    
    // Queue Trakt sync if enabled using production queue
    if (getSyncMode() === "trakt") {
      productionSyncQueue.enqueue({
        action: 'stopPlayback',
        metadata,
        percentage
      });
    }
  },

  saveProgress(metadata, currentTime, duration) {
    // Always save locally first (optimistic update)
    localProvider.saveProgress(metadata, currentTime, duration);

    // Clear aggregator cache so UI refreshes immediately
    continueWatchingAggregator.clearCache();

    // Queue Trakt sync if enabled using production queue with debouncing
    if (getSyncMode() === "trakt") {
      const safeDuration =
        duration && !Number.isNaN(duration) && duration !== Infinity ? duration : 0;
      const percentage =
        safeDuration > 0 ? (currentTime / safeDuration) * 100 : 0;

      productionSyncQueue.debouncedSync({
        action: 'syncProgress',
        metadata,
        percentage
      });
    }
  },

  removeProgress(type, id) {
    // Always remove from local storage immediately
    localProvider.removeProgress(type, id);

    // Clear aggregator cache so UI refreshes immediately
    continueWatchingAggregator.clearCache();

    // Queue Trakt removal if enabled using production queue
    if (getSyncMode() === "trakt") {
      productionSyncQueue.enqueue({
        action: 'removeProgress',
        type,
        id
      });
    }
  },

  // Helper method to build Trakt payload
  buildPayload(metadata, percentage) {
    if (metadata.type === "movie") {
      return {
        progress: Math.min(percentage, 100),
        movie: {
          ids: {
            imdb: metadata.imdbId,
          },
        },
      };
    }

    return {
      progress: Math.min(percentage, 100),
      episode: {
        season: Number(metadata.season),
        number: Number(metadata.episode),
      },
      show: {
        ids: {
          imdb: metadata.imdbId,
        },
      },
    };
  },

  // Helper method to update local progress from Trakt
  updateLocalProgress(type, id, traktData, season, episode) {
    const { saveProgress } = localProvider;
    
    if (type === 'movie') {
      // Convert Trakt percentage back to progress time
      const localData = localProvider.getMovieProgress(id);
      if (localData && localData.duration > 0) {
        const currentTime = (traktData.percentage / 100) * localData.duration;
        saveProgress({
          type: 'movie',
          id,
          title: localData.title,
          poster: localData.poster
        }, currentTime, localData.duration);
      }
    } else if (type === 'episode' && season && episode) {
      // Convert Trakt percentage back to progress time
      const localData = localProvider.getEpisodeProgress(id, season, episode);
      if (localData && localData.duration > 0) {
        const currentTime = (traktData.percentage / 100) * localData.duration;
        saveProgress({
          type: 'series',
          id,
          season,
          episode,
          title: localData.title,
          poster: localData.poster
        }, currentTime, localData.duration);
      }
    }
  },

  // Get sync queue status for UI
  getSyncStatus() {
    return productionSyncQueue.getSyncStatus();
  },

  // Retry failed sync operations
  retrySync() {
    return productionSyncQueue.retryAll();
  },

  // Clear continue watching cache
  clearContinueWatchingCache() {
    return continueWatchingAggregator.clearCache();
  },

  // Get next episode for series
  async getNextEpisode(seriesId, currentSeason, currentEpisode) {
    return continueWatchingAggregator.getNextEpisode(seriesId, currentSeason, currentEpisode);
  },

  // Get series progress
  async getSeriesProgress(seriesId) {
    return continueWatchingAggregator.getSeriesProgress(seriesId);
  }
};
