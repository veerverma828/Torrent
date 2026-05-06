import { traktApi } from "../../services/trakt/traktApi.js";

export const traktProvider = {
  type: "trakt",

  async syncMovieProgress(metadata, progress, percentage) {
    if (!metadata.imdbId) {
      return;
    }

    await traktApi.request("/scrobble/pause", {
      method: "POST",
      body: JSON.stringify({
        progress: Math.min(percentage, 100),
        movie: {
          ids: {
            imdb: metadata.imdbId,
          },
        },
      }),
    });
  },

  async syncEpisodeProgress(metadata, percentage) {
    if (!metadata.imdbId) {
      return;
    }

    await traktApi.request("/scrobble/pause", {
      method: "POST",
      body: JSON.stringify({
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
      }),
    });
  },

  async getContinueWatching() {
    try {
      return await traktApi.request("/sync/playback");
    } catch {
      return [];
    }
  },
};
