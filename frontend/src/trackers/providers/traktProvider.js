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
    };
  }

  return null;
};

export const traktProvider = {
  type: "trakt",

  async startPlayback(metadata) {
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
      body: JSON.stringify(buildPayload(metadata, 0)),
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
};
