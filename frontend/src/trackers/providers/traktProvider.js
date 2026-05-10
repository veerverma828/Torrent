import { traktApi } from "../../services/trakt/traktApi.js";

const activeSessions = new Set();

const buildPayload = (metadata, percentage) => {
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
};

const mapPlaybackItem = (item) => {
  const progress = Math.min(Math.max(item.progress || 0, 0), 100);

  if (item.type === "movie" && item.movie) {
    return {
      type: "movie",
      id: item.movie.ids?.imdb,
      imdbId: item.movie.ids?.imdb,
      title: item.movie.title || "Unknown Movie",
      percentage: progress,
      progress,
      poster: null,
      updatedAt: item.paused_at,
      source: "trakt",
    };
  }

  if (item.type === "episode" && item.show && item.episode) {
    return {
      type: "series",
      id: item.show.ids?.imdb,
      imdbId: item.show.ids?.imdb,
      seriesId: item.show.ids?.imdb,
      seriesTitle: item.show.title || "Unknown Series",
      seriesPoster: null,
      season: item.episode.season,
      episode: item.episode.number,
      episodeTitle: item.episode.title,
      percentage: progress,
      progress,
      updatedAt: item.paused_at,
      source: "trakt",
    };
  }

  return null;
};

const findPlaybackItem = (items, type, id, season, episode) => {
  return items.find((item) => {
    if (type === "movie") {
      return item.type === "movie" && item.movie?.ids?.imdb === id;
    }
    if (type === "series") {
      return (
        item.type === "episode" &&
        item.show?.ids?.imdb === id &&
        item.episode?.season === Number(season) &&
        item.episode?.number === Number(episode)
      );
    }
    return false;
  });
};

export const traktProvider = {
  type: "trakt",

  async startPlayback(metadata, percentage = 0) {
    if (!metadata?.imdbId) {
      return;
    }

    const sessionKey = `${metadata.type}-${metadata.imdbId}-${metadata.season || 0}-${metadata.episode || 0}`;

    if (activeSessions.has(sessionKey)) {
      return;
    }

    activeSessions.add(sessionKey);

    await traktApi.request("/scrobble/start", {
      method: "POST",
      body: JSON.stringify(buildPayload(metadata, percentage)),
    });
  },

  async stopPlayback(metadata, percentage = 100) {
    if (!metadata?.imdbId) {
      return;
    }

    const sessionKey = `${metadata.type}-${metadata.imdbId}-${metadata.season || 0}-${metadata.episode || 0}`;

    activeSessions.delete(sessionKey);

    await traktApi.request("/scrobble/stop", {
      method: "POST",
      body: JSON.stringify(buildPayload(metadata, percentage)),
    });
  },

  async syncMovieProgress(metadata, progress, percentage) {
    if (!metadata.imdbId) {
      return;
    }

    await traktApi.request("/scrobble/pause", {
      method: "POST",
      body: JSON.stringify(buildPayload(metadata, percentage)),
    });
  },

  async syncEpisodeProgress(metadata, percentage) {
    if (!metadata.imdbId) {
      return;
    }

    await traktApi.request("/scrobble/pause", {
      method: "POST",
      body: JSON.stringify(buildPayload(metadata, percentage)),
    });
  },

  async getContinueWatching() {
    try {
      const playbackItems = await traktApi.request("/sync/playback");

      return playbackItems
        .map(mapPlaybackItem)
        .filter(Boolean)
        .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    } catch {
      return [];
    }
  },

  async getMovieProgress(id) {
    try {
      const items = await traktApi.request("/sync/playback");
      const item = findPlaybackItem(items, "movie", id);
      if (!item) return null;
      return {
        progress: 0,
        percentage: Math.min(item.progress || 0, 100),
        updatedAt: item.paused_at,
      };
    } catch {
      return null;
    }
  },

  async getEpisodeProgress(seriesId, season, episode) {
    try {
      const items = await traktApi.request("/sync/playback");
      const item = findPlaybackItem(items, "series", seriesId, season, episode);
      if (!item) return null;
      return {
        progress: 0,
        percentage: Math.min(item.progress || 0, 100),
        updatedAt: item.paused_at,
      };
    } catch {
      return null;
    }
  },

  async removeProgress(type, id) {
    try {
      const items = await traktApi.request("/sync/playback");
      if (type === "movie") {
        const item = findPlaybackItem(items, "movie", id);
        if (item?.id) {
          await traktApi.request(`/sync/playback/${item.id}`, { method: "DELETE" });
        }
      } else if (type === "series") {
        const episodes = items.filter(
          (p) => p.type === "episode" && p.show?.ids?.imdb === id
        );
        for (const ep of episodes) {
          if (ep.id) {
            await traktApi.request(`/sync/playback/${ep.id}`, { method: "DELETE" });
          }
        }
      }
    } catch (e) {
      console.error("Failed to remove Trakt progress", e);
    }
  },

  async getWatchlist() {
    try {
      const items = await traktApi.request("/sync/watchlist");
      return items
        .map((item) => {
          if (item.type === "movie" && item.movie) {
            return {
              type: "movie",
              id: item.movie.ids?.imdb,
              imdbId: item.movie.ids?.imdb,
              title: item.movie.title || "Unknown Movie",
              year: item.movie.year,
              poster: null,
            };
          }
          if (item.type === "show" && item.show) {
            return {
              type: "series",
              id: item.show.ids?.imdb,
              imdbId: item.show.ids?.imdb,
              title: item.show.title || "Unknown Series",
              year: item.show.year,
              poster: null,
            };
          }
          return null;
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  },
};
