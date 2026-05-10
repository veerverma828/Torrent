import { localProvider } from "./providers/localProvider.js";
import { traktProvider } from "./providers/traktProvider.js";

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
    if (getSyncMode() === "trakt") {
      try {
        const data = await traktProvider.getMovieProgress(...args);
        if (data) return data;
      } catch {}
    }
    return localProvider.getMovieProgress(...args);
  },

  async getEpisodeProgress(...args) {
    if (getSyncMode() === "trakt") {
      try {
        const data = await traktProvider.getEpisodeProgress(...args);
        if (data) return data;
      } catch {}
    }
    return localProvider.getEpisodeProgress(...args);
  },

  async getContinueWatching(...args) {
    if (getSyncMode() !== "trakt") {
      return localProvider.getContinueWatching(...args);
    }

    const [traktResult, localResult] = await Promise.allSettled([
      traktProvider.getContinueWatching(...args),
      localProvider.getContinueWatching(...args),
    ]);

    const traktItems = traktResult.status === "fulfilled" ? traktResult.value : [];
    const localItems = localResult.status === "fulfilled" ? localResult.value : [];

    const merged = new Map();

    for (const item of localItems) {
      const key = item.type === "movie"
        ? `movie-${item.id}`
        : `series-${item.seriesId}-${item.season}-${item.episode}`;
      merged.set(key, item);
    }

    for (const item of traktItems) {
      const key = item.type === "movie"
        ? `movie-${item.id}`
        : `series-${item.seriesId}-${item.season}-${item.episode}`;
      merged.set(key, item);
    }

    return Array.from(merged.values()).sort((a, b) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : (a.lastUpdated || 0);
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : (b.lastUpdated || 0);
      return bTime - aTime;
    });
  },

  startPlayback(metadata, percentage) {
    getProvider().startPlayback?.(metadata, percentage);
  },

  stopPlayback(metadata, percentage) {
    getProvider().stopPlayback?.(metadata, percentage);
  },

  saveProgress(metadata, currentTime, duration) {
    localProvider.saveProgress(metadata, currentTime, duration);

    if (getSyncMode() !== "trakt") {
      return;
    }

    const safeDuration =
      duration && !Number.isNaN(duration) && duration !== Infinity ? duration : 0;

    const percentage =
      safeDuration > 0 ? (currentTime / safeDuration) * 100 : 0;

    if (metadata.type === "movie") {
      traktProvider.syncMovieProgress(metadata, currentTime, percentage);
    } else if (metadata.type === "series") {
      traktProvider.syncEpisodeProgress(metadata, percentage);
    }
  },

  removeProgress(type, id) {
    localProvider.removeProgress(type, id);
    if (getSyncMode() === "trakt") {
      traktProvider.removeProgress(type, id);
    }
  },
};
