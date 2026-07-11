/**
 * Watch Progress Tracking System
 *
 * The single source of truth for watch progress. Every UI read goes through
 * this module directly, regardless of sync mode — Trakt mode only changes
 * what happens *around* these writes (see progressService.js /
 * traktReconciliation.js), never how reads work.
 */
import { WATCH_COMPLETED_PERCENTAGE } from "../utils/constants.js";

const STORAGE_KEY = 'watch_progress';

// Local cache to prevent redundant JSON parsing & localStorage reads in the same render loop
let cachedStorage = null;
let cacheTimer = null;

// Another tab may write watch_progress directly — invalidate our cache so
// the next read picks up the fresh value instead of a stale in-memory copy.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      cachedStorage = null;
    }
  });
}

export const getStorage = () => {
  if (cachedStorage) return cachedStorage;

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    cachedStorage = data ? JSON.parse(data) : { movies: {}, series: {} };
  } catch {
    cachedStorage = { movies: {}, series: {} };
  }

  // Clear cache after current execution stack to ensure fresh reads later
  if (!cacheTimer) {
    cacheTimer = setTimeout(() => {
      cachedStorage = null;
      cacheTimer = null;
    }, 50); // 50ms cache window
  }

  return cachedStorage;
};

const setStorage = (data) => {
  cachedStorage = data; // Immedately update cache
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    // Handle local storage quota limit exceeded
    if (e.name === 'QuotaExceededError') {
      cleanupStorage(true);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedStorage));
      } catch (err) {
        console.error('Storage full even after cleanup.', err);
      }
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("watch-progress-changed"));
  }
};

export const getMovieProgress = (id) => {
  const data = getStorage();
  return data.movies[id] || null;
};

export const getEpisodeProgress = (seriesId, season, episode) => {
  const data = getStorage();
  return data.series[seriesId]?.seasons?.[season]?.episodes?.[episode] || null;
};

export const getContinueWatching = (limit = 50) => {
  const data = getStorage();
  const list = [];

  // Movies
  for (const [id, movie] of Object.entries(data.movies)) {
    if (movie.percentage > 0 && !movie.completed) {
      list.push({ ...movie, id, type: 'movie' });
    }
  }

  // Series
  for (const [seriesId, series] of Object.entries(data.series)) {
    if (series.completed) continue;
    let latestEpisode = null;
    let latestWatched = null; // most recent episode regardless of completion

    for (const [seasonNum, season] of Object.entries(series.seasons || {})) {
      for (const [epNum, ep] of Object.entries(season.episodes || {})) {
        if (ep.percentage > 0 && (!latestWatched || ep.lastUpdated > latestWatched.lastUpdated)) {
          latestWatched = { ...ep, seasonNum: Number(seasonNum), epNum: Number(epNum), episodesInSeason: season.episodesInSeason };
        }
        if (!ep.completed && ep.percentage > 0) {
          // Capture latest incomplete episode per series
          if (!latestEpisode || ep.lastUpdated > latestEpisode.lastUpdated) {
            latestEpisode = { ...ep, seriesId, season: seasonNum, episode: epNum, seriesTitle: series.title || "Unknown Series", seriesPoster: series.poster };
          }
        }
      }
    }

    if (latestEpisode) {
      list.push({ ...latestEpisode, type: 'series' });
    } else if (latestWatched?.completed) {
      // Everything watched so far is finished — surface the NEXT episode so
      // the series doesn't vanish from Continue Watching mid-season.
      const next = nextEpisodeAfter(latestWatched, series);
      if (next) {
        list.push({
          type: 'series',
          isNext: true,
          percentage: 0,
          completed: false,
          lastUpdated: latestWatched.lastUpdated,
          seriesId,
          season: String(next.season),
          episode: String(next.episode),
          seriesTitle: series.title || "Unknown Series",
          seriesPoster: series.poster,
          magnet: "",
        });
      }
    }
  }

  return list.sort((a, b) => b.lastUpdated - a.lastUpdated).slice(0, limit);
};

// Next episode after `latest` ({seasonNum, epNum, episodesInSeason}) using the
// persisted season shape. Falls back to "next number in same season" when the
// season's episode count was never recorded (older progress entries).
const nextEpisodeAfter = (latest, series) => {
  const { seasonNum, epNum, episodesInSeason } = latest;
  if (!episodesInSeason || epNum < episodesInSeason) {
    return { season: seasonNum, episode: epNum + 1 };
  }
  const totalSeasons = series.totalSeasons;
  if (totalSeasons && seasonNum >= totalSeasons) return null; // series over
  return { season: seasonNum + 1, episode: 1 };
};

export const updateTrackingMetadata = (type, id, title, poster) => {
  let data = getStorage();
  let updated = false;

  if (type === 'movie' && data.movies[id]) {
    data.movies[id].title = title || data.movies[id].title;
    data.movies[id].poster = poster || data.movies[id].poster;
    updated = true;
  } else if (type === 'series' && data.series[id]) {
    data.series[id].title = title || data.series[id].title;
    data.series[id].poster = poster || data.series[id].poster;
    updated = true;
  }

  if (updated) setStorage(data);
};

export const removeProgress = (type, id) => {
  let data = getStorage();
  if (type === 'movie' && data.movies[id]) {
    delete data.movies[id];
    setStorage(data);
  } else if (type === 'series' && data.series[id]) {
    delete data.series[id];
    setStorage(data);
  }
};

// currentTime/duration are seconds — the only form the <video> element ever
// gives us — but that's purely an input boundary. Everything downstream of
// this function, including storage, only ever deals in percentage.
export const saveProgress = (metadata, currentTime, duration) => {
  if (!currentTime || currentTime <= 0) return null; // Prevent saving blank 0-second starts

  // Handle live/remote streams where duration returns as NaN or Infinity
  const safeDuration = (duration && !isNaN(duration) && duration !== Infinity) ? duration : 0;
  if (safeDuration <= 0) return null; // Can't derive a percentage without a known duration

  const percentage = Math.min((currentTime / safeDuration) * 100, 100);
  const isCompleted = percentage > WATCH_COMPLETED_PERCENTAGE;

  let data = getStorage();

  if (metadata.type === 'movie') {
    data.movies[metadata.id] = {
      ...(data.movies[metadata.id] || {}), // Preserve historical data if missing
      percentage,
      completed: isCompleted,
      lastUpdated: Date.now(),
      title: metadata.title || data.movies[metadata.id]?.title || "Unknown Movie",
      poster: metadata.poster || data.movies[metadata.id]?.poster || "",
      magnet: metadata.magnet || data.movies[metadata.id]?.magnet || ""
    };
  } else if (metadata.type === 'series') {
    const { id, season, episode, totalSeasons, episodesInSeason, title, poster, episodeTitle, thumbnail, magnet } = metadata;

    if (!data.series[id]) data.series[id] = { completed: false, seasons: {} };
    // Store/Update top-level series visual metadata seamlessly
    data.series[id].title = title || data.series[id].title || "Unknown Series";
    data.series[id].poster = poster || data.series[id].poster || "";

    if (!data.series[id].seasons[season]) data.series[id].seasons[season] = { completed: false, episodes: {} };

    data.series[id].seasons[season].episodes[episode] = {
      ...(data.series[id].seasons[season].episodes[episode] || {}),
      percentage,
      completed: isCompleted,
      lastUpdated: Date.now(),
      episodeTitle: episodeTitle || data.series[id].seasons[season].episodes[episode]?.episodeTitle || "",
      thumbnail: thumbnail || data.series[id].seasons[season].episodes[episode]?.thumbnail || "",
      magnet: magnet || data.series[id].seasons[season].episodes[episode]?.magnet || ""
    };

    // Persist season shape so Continue Watching can compute "next episode"
    // after this one is finished (see getContinueWatching).
    if (episodesInSeason) data.series[id].seasons[season].episodesInSeason = Number(episodesInSeason);
    if (totalSeasons) data.series[id].totalSeasons = Number(totalSeasons);

    // Evaluate Series Completion Logic
    if (isCompleted && totalSeasons && episodesInSeason) {
      checkSeriesCompletion(data, id, season, totalSeasons, episodesInSeason);
    }
  }

  setStorage(data);

  // Callers that also need to push this to Trakt (progressService) reuse
  // this exact value instead of recomputing percentage themselves.
  return { percentage, completed: isCompleted };
};

// Remote (Trakt) progress reconciliation — writes through only if the
// remote record is newer than what's stored locally, so local edits made
// while offline (or between reconcile cycles) are never clobbered by a
// stale pull.
export const mergeRemoteMovieProgress = (id, remote) => {
  let data = getStorage();
  const existing = data.movies[id];

  if (existing && existing.lastUpdated >= remote.lastUpdated) return;

  const percentage = Math.min(Math.max(remote.percentage ?? 0, 0), 100);

  data.movies[id] = {
    ...(existing || {}),
    percentage,
    completed: Boolean(remote.completed) || percentage > WATCH_COMPLETED_PERCENTAGE,
    lastUpdated: remote.lastUpdated,
    title: remote.title || existing?.title || "Unknown Movie",
    poster: remote.poster || existing?.poster || "",
    magnet: existing?.magnet || "",
  };

  setStorage(data);
};

export const mergeRemoteEpisodeProgress = (seriesId, season, episode, remote, seriesMeta = {}) => {
  let data = getStorage();

  if (!data.series[seriesId]) data.series[seriesId] = { completed: false, seasons: {} };
  const seriesEntry = data.series[seriesId];
  seriesEntry.title = seriesMeta.title || seriesEntry.title || "Unknown Series";
  seriesEntry.poster = seriesMeta.poster || seriesEntry.poster || "";

  if (!seriesEntry.seasons[season]) seriesEntry.seasons[season] = { completed: false, episodes: {} };
  const existing = seriesEntry.seasons[season].episodes[episode];

  if (existing && existing.lastUpdated >= remote.lastUpdated) return;

  const percentage = Math.min(Math.max(remote.percentage ?? 0, 0), 100);

  seriesEntry.seasons[season].episodes[episode] = {
    ...(existing || {}),
    percentage,
    completed: Boolean(remote.completed) || percentage > WATCH_COMPLETED_PERCENTAGE,
    lastUpdated: remote.lastUpdated,
    episodeTitle: remote.episodeTitle || existing?.episodeTitle || "",
    thumbnail: remote.thumbnail || existing?.thumbnail || "",
    magnet: existing?.magnet || "",
  };

  setStorage(data);
};

const checkSeriesCompletion = (data, seriesId, currentSeason, totalSeasons, episodesInSeason) => {
  const seriesData = data.series[seriesId];
  if (!seriesData) return;

  const seasonData = seriesData.seasons[currentSeason];
  if (seasonData) {
    const completedEpisodes = Object.values(seasonData.episodes).filter(ep => ep.completed).length;
    if (completedEpisodes >= episodesInSeason) seasonData.completed = true;
  }

  // If number of completed seasons matches the series metadata, the whole
  // series is done — flag it rather than deleting it, so it's retained for
  // history/Trakt-parity purposes and simply drops out of Continue
  // Watching via the `completed` flag.
  const completedSeasons = Object.values(seriesData.seasons).filter(s => s.completed).length;
  if (completedSeasons >= totalSeasons && totalSeasons > 0) {
    seriesData.completed = true;
  }
};

export const cleanupStorage = (force = false) => {
  let data = getStorage();

  // Hard flush only (quota exceeded): trim the oldest ~20% of completed
  // series and movies. Never prune anything unconditionally — completed
  // entries are kept by default so history/Trakt-parity checks have data.
  if (force) {
    const movies = Object.entries(data.movies).sort((a, b) => a[1].lastUpdated - b[1].lastUpdated);
    if (movies.length > 0) {
      const toRemove = Math.max(1, Math.floor(movies.length * 0.2));
      for (let i = 0; i < toRemove; i++) {
        delete data.movies[movies[i][0]];
      }
    }

    const completedSeries = Object.entries(data.series)
      .filter(([, series]) => series.completed)
      .sort((a, b) => {
        const aLatest = Math.max(0, ...Object.values(a[1].seasons || {}).flatMap(s => Object.values(s.episodes || {}).map(e => e.lastUpdated || 0)));
        const bLatest = Math.max(0, ...Object.values(b[1].seasons || {}).flatMap(s => Object.values(s.episodes || {}).map(e => e.lastUpdated || 0)));
        return aLatest - bLatest;
      });
    if (completedSeries.length > 0) {
      const toRemove = Math.max(1, Math.floor(completedSeries.length * 0.2));
      for (let i = 0; i < toRemove; i++) {
        delete data.series[completedSeries[i][0]];
      }
    }
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Best-effort cleanup write — if it still fails, nothing more we can do.
  }
};
