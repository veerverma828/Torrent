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

  getMovieProgress(...args) {
    return localProvider.getMovieProgress(...args);
  },

  getEpisodeProgress(...args) {
    return localProvider.getEpisodeProgress(...args);
  },

  getContinueWatching(...args) {
    return getProvider().getContinueWatching(...args);
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

  removeProgress(...args) {
    return localProvider.removeProgress(...args);
  },
};
