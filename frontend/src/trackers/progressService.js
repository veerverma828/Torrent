import { localProvider } from "./providers/localProvider.js";
import { traktProvider } from "./providers/traktProvider.js";
import { syncQueueService } from "../services/syncQueueService.js";

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
    const syncMode = getSyncMode();
    
    if (syncMode !== "trakt") {
      const localItems = localProvider.getContinueWatching(...args);
      return localItems.map(item => ({
        ...item,
        syncMode: 'local'
      }));
    }

    const [traktResult, localResult] = await Promise.allSettled([
      traktProvider.getContinueWatching(...args),
      localProvider.getContinueWatching(...args),
    ]);

    const traktItems = traktResult.status === "fulfilled" ? traktResult.value : [];
    const localItems = localResult.status === "fulfilled" ? localResult.value : [];

    const merged = new Map();

    // Add local items first (as fallback)
    for (const item of localItems) {
      const key = item.type === "movie"
        ? `movie-${item.id}`
        : `series-${item.seriesId}-${item.season}-${item.episode}`;
      merged.set(key, { ...item, source: 'local' });
    }

    // Overlay Trakt items (takes precedence)
    for (const item of traktItems) {
      const key = item.type === "movie"
        ? `movie-${item.id}`
        : `series-${item.seriesId}-${item.season}-${item.episode}`;
      merged.set(key, { ...item, source: 'trakt' });
    }

    // Convert to array and add sync mode to all items for consistent color determination
    return Array.from(merged.values()).map(item => ({
      ...item,
      syncMode: 'trakt' // Always indicate Trakt mode is enabled
    })).sort((a, b) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : (a.lastUpdated || 0);
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : (b.lastUpdated || 0);
      return bTime - aTime;
    });
  },

  startPlayback(metadata, percentage) {
    // Always start local playback immediately
    localProvider.startPlayback?.(metadata, percentage);
    
    // Queue Trakt sync if enabled
    if (getSyncMode() === "trakt") {
      const payload = traktProvider.buildPayload?.(metadata, percentage) || this.buildPayload(metadata, percentage);
      syncQueueService.enqueue({
        action: 'startPlayback',
        metadata,
        payload
      });
    }
  },

  stopPlayback(metadata, percentage) {
    // Always stop local playback immediately
    localProvider.stopPlayback?.(metadata, percentage);
    
    // Queue Trakt sync if enabled
    if (getSyncMode() === "trakt") {
      const payload = traktProvider.buildPayload?.(metadata, percentage) || this.buildPayload(metadata, percentage);
      syncQueueService.enqueue({
        action: 'stopPlayback',
        metadata,
        payload
      });
    }
  },

  saveProgress(metadata, currentTime, duration) {
    // Always save locally first (optimistic update)
    localProvider.saveProgress(metadata, currentTime, duration);

    // Queue Trakt sync if enabled (debounced to avoid spam)
    if (getSyncMode() === "trakt") {
      const safeDuration =
        duration && !Number.isNaN(duration) && duration !== Infinity ? duration : 0;
      const percentage =
        safeDuration > 0 ? (currentTime / safeDuration) * 100 : 0;
      
      const payload = traktProvider.buildPayload?.(metadata, percentage) || this.buildPayload(metadata, percentage);
      
      syncQueueService.debouncedSync({
        action: 'syncProgress',
        metadata,
        payload
      });
    }
  },

  removeProgress(type, id) {
    // Always remove from local storage immediately
    localProvider.removeProgress(type, id);
    
    // Queue Trakt removal if enabled
    if (getSyncMode() === "trakt") {
      syncQueueService.enqueue({
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
    return syncQueueService.getSyncStatus();
  },

  // Retry failed sync operations
  retrySync() {
    return syncQueueService.retryAll();
  }
};
