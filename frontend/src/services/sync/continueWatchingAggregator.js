/**
 * Production-Grade Continue Watching Aggregator
 * Merges local and Trakt data with intelligent conflict resolution
 */

class ContinueWatchingAggregator {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.lastFetch = 0;
  }

  /**
   * Get merged continue watching list
   */
  async getContinueWatching(limit = 50) {
    const now = Date.now();
    
    // Return cached data if fresh
    if (now - this.lastFetch < this.cacheTimeout && this.cache.has('continueWatching')) {
      return this.cache.get('continueWatching');
    }

    const syncMode = localStorage.getItem('syncMode') || 'local';
    
    if (syncMode !== 'trakt') {
      const localItems = await this.getLocalContinueWatching(limit);
      const result = localItems.map(item => ({ ...item, source: 'local' }));
      this.cache.set('continueWatching', result);
      this.lastFetch = now;
      return result;
    }

    // Fetch both sources in parallel
    const [traktResult, localResult] = await Promise.allSettled([
      this.getTraktContinueWatching(),
      this.getLocalContinueWatching(limit)
    ]);

    const traktItems = traktResult.status === 'fulfilled' ? traktResult.value : [];
    const localItems = localResult.status === 'fulfilled' ? localResult.value : [];

    // Merge with intelligent conflict resolution
    const merged = this.mergeContinueWatchingLists(traktItems, localItems);
    
    // Sort by watch priority and recency
    const sorted = this.sortByWatchPriority(merged);
    
    // Cache result
    this.cache.set('continueWatching', sorted);
    this.lastFetch = now;

    return sorted;
  }

  /**
   * Get Trakt continue watching data
   */
  async getTraktContinueWatching() {
    try {
      const { traktApi } = await import('../trakt/traktApi.js');
      
      // Get active playback sessions
      const playbackItems = await traktApi.request('/sync/playback');
      const activeItems = playbackItems.map(this.mapTraktPlaybackItem).filter(Boolean);

      // Get recent history for completed items that should still appear
      const historyItems = await traktApi.request('/sync/history', {
        params: { limit: 20, type: 'movies,shows' }
      });
      
      const recentHistory = historyItems
        .filter(item => this.shouldIncludeInContinueWatching(item))
        .map(this.mapTraktHistoryItem)
        .filter(Boolean);

      return [...activeItems, ...recentHistory];
    } catch (error) {
      console.error('[ContinueWatching] Failed to fetch Trakt data:', error);
      return [];
    }
  }

  /**
   * Get local continue watching data
   */
  async getLocalContinueWatching(limit = 50) {
    try {
      const { localProvider } = await import('../../trackers/providers/localProvider.js');
      return localProvider.getContinueWatching(limit);
    } catch (error) {
      console.error('[ContinueWatching] Failed to fetch local data:', error);
      return [];
    }
  }

  /**
   * Merge Trakt and local continue watching lists
   */
  mergeContinueWatchingLists(traktItems, localItems) {
    const merged = new Map();

    // Add local items first (as fallback)
    for (const item of localItems) {
      const key = this.getItemKey(item);
      merged.set(key, {
        ...item,
        source: 'local',
        syncPriority: this.getLocalPriority(item)
      });
    }

    // Overlay Trakt items with higher priority
    for (const item of traktItems) {
      const key = this.getItemKey(item);
      const existing = merged.get(key);
      
      if (!existing || this.shouldOverrideLocal(existing, item)) {
        merged.set(key, {
          ...item,
          source: 'trakt',
          syncPriority: this.getTraktPriority(item)
        });
      }
    }

    return Array.from(merged.values());
  }

  /**
   * Sort items by watch priority and recency
   */
  sortByWatchPriority(items) {
    return items.sort((a, b) => {
      // First sort by completion status (incomplete items first)
      const aCompleted = this.isCompleted(a);
      const bCompleted = this.isCompleted(b);
      
      if (aCompleted !== bCompleted) {
        return aCompleted ? 1 : -1;
      }

      // Then by sync priority
      const aPriority = a.syncPriority || 0;
      const bPriority = b.syncPriority || 0;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      // Finally by timestamp
      const aTime = a.updatedAt || a.lastUpdated || 0;
      const bTime = b.updatedAt || b.lastUpdated || 0;
      
      return bTime - aTime;
    });
  }

  /**
   * Map Trakt playback item to standard format
   */
  mapTraktPlaybackItem(item) {
    const progress = Math.min(Math.max(item.progress || 0, 0), 100);

    if (item.type === 'movie' && item.movie) {
      return {
        type: 'movie',
        id: item.movie.ids?.imdb,
        imdbId: item.movie.ids?.imdb,
        title: item.movie.title || 'Unknown Movie',
        year: item.movie.year,
        percentage: progress,
        progress,
        updatedAt: item.paused_at,
        isActive: true,
        source: 'trakt'
      };
    }

    if (item.type === 'episode' && item.show && item.episode) {
      return {
        type: 'series',
        id: item.show.ids?.imdb,
        imdbId: item.show.ids?.imdb,
        seriesId: item.show.ids?.imdb,
        seriesTitle: item.show.title || 'Unknown Series',
        season: item.episode.season,
        episode: item.episode.number,
        episodeTitle: item.episode.title,
        percentage: progress,
        progress,
        updatedAt: item.paused_at,
        isActive: true,
        source: 'trakt'
      };
    }

    return null;
  }

  /**
   * Map Trakt history item to standard format
   */
  mapTraktHistoryItem(item) {
    if (item.watched_at && new Date(item.watched_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
      // Only include items watched in last 7 days
      if (item.type === 'movie' && item.movie) {
        return {
          type: 'movie',
          id: item.movie.ids?.imdb,
          imdbId: item.movie.ids?.imdb,
          title: item.movie.title || 'Unknown Movie',
          year: item.movie.year,
          percentage: 100,
          progress: 100,
          updatedAt: item.watched_at,
          isCompleted: true,
          source: 'trakt'
        };
      }

      if (item.type === 'episode' && item.show && item.episode) {
        return {
          type: 'series',
          id: item.show.ids?.imdb,
          imdbId: item.show.ids?.imdb,
          seriesId: item.show.ids?.imdb,
          seriesTitle: item.show.title || 'Unknown Series',
          season: item.episode.season,
          episode: item.episode.number,
          episodeTitle: item.episode.title,
          percentage: 100,
          progress: 100,
          updatedAt: item.watched_at,
          isCompleted: true,
          source: 'trakt'
        };
      }
    }

    return null;
  }

  /**
   * Get unique key for item
   */
  getItemKey(item) {
    if (item.type === 'movie') {
      return `movie-${item.imdbId}`;
    } else if (item.type === 'series') {
      return `series-${item.imdbId}-${item.season}-${item.episode}`;
    }
    return `${item.type}-${item.id}`;
  }

  /**
   * Determine if Trakt item should override local
   */
  shouldOverrideLocal(localItem, traktItem) {
    // Active Trakt sessions always take priority
    if (traktItem.isActive) {
      return true;
    }

    // Compare timestamps
    const localTime = localItem.updatedAt || localItem.lastUpdated || 0;
    const traktTime = traktItem.updatedAt || 0;

    return traktTime > localTime;
  }

  /**
   * Get local item priority
   */
  getLocalPriority(item) {
    let priority = 50; // Base priority

    if (item.isActive) priority += 30;
    if (!this.isCompleted(item)) priority += 20;
    if (item.percentage > 80) priority += 10;

    return priority;
  }

  /**
   * Get Trakt item priority
   */
  getTraktPriority(item) {
    let priority = 60; // Higher base priority for Trakt

    if (item.isActive) priority += 40;
    if (!this.isCompleted(item)) priority += 25;
    if (item.percentage > 80) priority += 15;

    return priority;
  }

  /**
   * Check if item should be included in continue watching
   */
  shouldIncludeInContinueWatching(item) {
    // Include recently completed items (last 3 days)
    if (item.watched_at) {
      const watchedDate = new Date(item.watched_at);
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      return watchedDate > threeDaysAgo;
    }
    return false;
  }

  /**
   * Check if item is completed
   */
  isCompleted(item) {
    return item.percentage >= 90 || item.isCompleted || item.progress >= 90;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    this.lastFetch = 0;
  }

  /**
   * Get next episode for series
   */
  async getNextEpisode(seriesId, currentSeason, currentEpisode) {
    try {
      const { traktApi } = await import('../trakt/traktApi.js');
      
      // Get show progress to determine next episode
      const progress = await traktApi.request(`/shows/${seriesId}/progress/watched`);
      
      for (const season of progress.seasons) {
        if (season.number === currentSeason) {
          // Find next episode in current season
          const nextEp = season.episodes.find(ep => 
            ep.number > currentEpisode && !ep.completed
          );
          if (nextEp) {
            return {
              season: nextEp.season,
              episode: nextEp.number,
              title: nextEp.title
            };
          }
        } else if (season.number > currentSeason) {
          // First episode of next season
          const firstEp = season.episodes.find(ep => !ep.completed);
          if (firstEp) {
            return {
              season: firstEp.season,
              episode: firstEp.number,
              title: firstEp.title
            };
          }
        }
      }

      return null; // No next episode found
    } catch (error) {
      console.error('[ContinueWatching] Failed to get next episode:', error);
      return null;
    }
  }

  /**
   * Get watch progress for entire series
   */
  async getSeriesProgress(seriesId) {
    try {
      const { traktApi } = await import('../trakt/traktApi.js');
      
      const progress = await traktApi.request(`/shows/${seriesId}/progress/watched`);
      
      return {
        aired: progress.aired || 0,
        completed: progress.completed || 0,
        lastWatched: progress.last_watched_at,
        nextEpisode: progress.next_episode,
        reset_at: progress.reset_at
      };
    } catch (error) {
      console.error('[ContinueWatching] Failed to get series progress:', error);
      return null;
    }
  }
}

export const continueWatchingAggregator = new ContinueWatchingAggregator();
