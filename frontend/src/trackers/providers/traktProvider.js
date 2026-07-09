import { traktApi } from "../../services/trakt/traktApi.js";

// Export buildPayload for use by the sync queue when building scrobble bodies.
export const buildPayload = (metadata, percentage) => {
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

// Maps a raw /sync/playback item to the shape progressTracker.mergeRemote*
// expects. Playback items are always in-progress (never completed).
export const mapPlaybackItemToLocal = (item) => {
  const percentage = Math.min(Math.max(item.progress || 0, 0), 100);
  const lastUpdated = item.paused_at ? new Date(item.paused_at).getTime() : Date.now();

  if (item.type === "movie" && item.movie) {
    return {
      kind: "movie",
      id: item.movie.ids?.imdb,
      remote: {
        percentage,
        lastUpdated,
        completed: false,
        title: item.movie.title || "Unknown Movie",
        poster: null,
      },
    };
  }

  if (item.type === "episode" && item.show && item.episode) {
    return {
      kind: "episode",
      seriesId: item.show.ids?.imdb,
      season: item.episode.season,
      episode: item.episode.number,
      remote: {
        percentage,
        lastUpdated,
        completed: false,
        episodeTitle: item.episode.title || "",
        thumbnail: null,
      },
      seriesMeta: {
        title: item.show.title || "Unknown Series",
        poster: null,
      },
    };
  }

  return null;
};

// Maps a raw /sync/history/{movies|episodes} item to the same shape.
// History items are always completed watches.
export const mapHistoryItemToLocal = (item) => {
  const lastUpdated = item.watched_at ? new Date(item.watched_at).getTime() : Date.now();

  if (item.type === "movie" && item.movie) {
    return {
      kind: "movie",
      id: item.movie.ids?.imdb,
      remote: {
        percentage: 100,
        lastUpdated,
        completed: true,
        title: item.movie.title || "Unknown Movie",
        poster: null,
      },
    };
  }

  if (item.type === "episode" && item.show && item.episode) {
    return {
      kind: "episode",
      seriesId: item.show.ids?.imdb,
      season: item.episode.season,
      episode: item.episode.number,
      remote: {
        percentage: 100,
        lastUpdated,
        completed: true,
        episodeTitle: item.episode.title || "",
        thumbnail: null,
      },
      seriesMeta: {
        title: item.show.title || "Unknown Series",
        poster: null,
      },
    };
  }

  return null;
};

export const traktProvider = {
  type: "trakt",
  buildPayload,

  async startPlayback(metadata, percentage = 0) {
    if (!metadata?.imdbId) {
      return;
    }

    await traktApi.request("/scrobble/start", {
      method: "POST",
      body: JSON.stringify(buildPayload(metadata, percentage)),
    });
  },

  async stopPlayback(metadata, percentage = 100) {
    if (!metadata?.imdbId) {
      return;
    }

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

  // Raw /sync/history add — used only for retroactively-completed local
  // items that were never scrobbled live (initial connect/mode-switch push).
  // Takes movies as [{imdbId}] and episodes as [{imdbId, season, episode}]
  // (show imdb id + season/episode number — no per-episode Trakt/TVDB id
  // is available locally) and builds Trakt's required nested shape:
  // { movies: [{ids:{imdb}}], shows: [{ids:{imdb}, seasons:[{number, episodes:[{number}]}]}] }
  async addToHistory({ movies = [], episodes = [] }) {
    if (movies.length === 0 && episodes.length === 0) return;

    const payloadMovies = movies
      .filter((m) => m.imdbId)
      .map((m) => ({ ids: { imdb: m.imdbId } }));

    const showsByImdbId = new Map();
    for (const ep of episodes) {
      if (!ep.imdbId || ep.season == null || ep.episode == null) continue;

      if (!showsByImdbId.has(ep.imdbId)) {
        showsByImdbId.set(ep.imdbId, { ids: { imdb: ep.imdbId }, seasonsByNumber: new Map() });
      }
      const show = showsByImdbId.get(ep.imdbId);

      const seasonNum = Number(ep.season);
      if (!show.seasonsByNumber.has(seasonNum)) {
        show.seasonsByNumber.set(seasonNum, []);
      }
      show.seasonsByNumber.get(seasonNum).push({ number: Number(ep.episode) });
    }

    const payloadShows = [...showsByImdbId.values()].map((show) => ({
      ids: show.ids,
      seasons: [...show.seasonsByNumber.entries()].map(([number, eps]) => ({
        number,
        episodes: eps,
      })),
    }));

    if (payloadMovies.length === 0 && payloadShows.length === 0) return;

    await traktApi.request("/sync/history", {
      method: "POST",
      body: JSON.stringify({ movies: payloadMovies, shows: payloadShows }),
    });
  },

  // Raw pull primitives — consumed only by traktReconciliation.js, never by
  // UI code directly.
  async fetchPlaybackItems() {
    try {
      const items = await traktApi.request("/sync/playback");
      return Array.isArray(items) ? items : [];
    } catch (e) {
      console.error("Failed to fetch Trakt playback items", e);
      return [];
    }
  },

  async fetchHistory({ type, limit = 50 } = {}) {
    try {
      const items = await traktApi.request(`/sync/history/${type}?limit=${limit}`);
      return Array.isArray(items) ? items : [];
    } catch (e) {
      console.error(`Failed to fetch Trakt history (${type})`, e);
      return [];
    }
  },

  async removeProgress(type, id) {
    try {
      const items = await this.fetchPlaybackItems();
      if (type === "movie") {
        const item = items.find((p) => p.type === "movie" && p.movie?.ids?.imdb === id);
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
