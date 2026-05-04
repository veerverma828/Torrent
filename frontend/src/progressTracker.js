/**
 * Watch Progress Tracking System
 */

const STORAGE_KEY = 'watch_progress';

// Local cache to prevent redundant JSON parsing & localStorage reads in the same render loop
let cachedStorage = null;
let cacheTimer = null;

export const getStorage = () => {
  if (cachedStorage) return cachedStorage;
  
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    cachedStorage = data ? JSON.parse(data) : { movies: {}, series: {} };
  } catch (e) {
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
};

export const getMovieProgress = (id) => {
  const data = getStorage();
  return data.movies[id] || null;
};

export const getEpisodeProgress = (seriesId, season, episode) => {
  const data = getStorage();
  return data.series[seriesId]?.seasons?.[season]?.episodes?.[episode] || null;
};

export const getContinueWatching = () => {
  const data = getStorage();
  const list = [];

  // Movies
  for (const [id, movie] of Object.entries(data.movies)) {
    if (movie.percentage > 0 && movie.percentage <= 90) {
      list.push({ ...movie, id, type: 'movie' });
    }
  }

  // Series
  for (const [seriesId, series] of Object.entries(data.series)) {
    if (series.completed) continue;
    let latestEpisode = null;
    
    for (const [seasonNum, season] of Object.entries(series.seasons || {})) {
      for (const [epNum, ep] of Object.entries(season.episodes || {})) {
        if (!ep.completed && ep.percentage > 0) {
          // Capture the latest incomplete episode per series
          if (!latestEpisode || ep.lastUpdated > latestEpisode.lastUpdated) {
            latestEpisode = { ...ep, seriesId, season: seasonNum, episode: epNum, seriesTitle: series.title || "Unknown Series", seriesPoster: series.poster };
          }
        }
      }
    }
    
    if (latestEpisode) {
      list.push({ ...latestEpisode, type: 'series' });
    }
  }

  return list.sort((a, b) => b.lastUpdated - a.lastUpdated); // Sort by most recent
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

export const saveProgress = (metadata, currentTime, duration) => {
  if (!duration || isNaN(duration) || duration <= 0) return;
  const percentage = (currentTime / duration) * 100;
  const isCompleted = percentage > 90;
  
  let data = getStorage();
  
  if (metadata.type === 'movie') {
    data.movies[metadata.id] = {
      ...(data.movies[metadata.id] || {}), // Preserve historical data if missing
      progress: currentTime,
      duration: duration,
      percentage: Math.min(percentage, 100),
      lastUpdated: Date.now(),
      title: metadata.title || data.movies[metadata.id]?.title || "Unknown Movie",
      poster: metadata.poster || data.movies[metadata.id]?.poster || ""
    };
  } else if (metadata.type === 'series') {
    const { id, season, episode, totalSeasons, episodesInSeason, title, poster, episodeTitle, thumbnail } = metadata;
    
    if (!data.series[id]) data.series[id] = { completed: false, seasons: {} };
    // Store/Update top-level series visual metadata seamlessly
    data.series[id].title = title || data.series[id].title || "Unknown Series";
    data.series[id].poster = poster || data.series[id].poster || "";

    if (!data.series[id].seasons[season]) data.series[id].seasons[season] = { completed: false, episodes: {} };
    
    data.series[id].seasons[season].episodes[episode] = {
      ...(data.series[id].seasons[season].episodes[episode] || {}),
      progress: currentTime,
      duration: duration,
      percentage: Math.min(percentage, 100),
      completed: isCompleted,
      lastUpdated: Date.now(),
      episodeTitle: episodeTitle || data.series[id].seasons[season].episodes[episode]?.episodeTitle || "",
      thumbnail: thumbnail || data.series[id].seasons[season].episodes[episode]?.thumbnail || ""
    };

    // Evaluate Series Completion Logic
    if (isCompleted && totalSeasons && episodesInSeason) {
      checkSeriesCompletion(data, id, season, totalSeasons, episodesInSeason);
    }
  }
  
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

  // If number of completed seasons matches the series metadata, it's done entirely
  const completedSeasons = Object.values(seriesData.seasons).filter(s => s.completed).length;
  if (completedSeasons >= totalSeasons && totalSeasons > 0) {
    delete data.series[seriesId]; // 🗑️ DELETE entire series when perfectly completed
  }
};

export const cleanupStorage = (force = false) => {
  let data = getStorage();
  
  // Explicitly remove completed series logic, just to be safe during hard cleanup
  for (const seriesId in data.series) {
    if (data.series[seriesId].completed) delete data.series[seriesId];
  }

  // Hard flush: Never remove movie progress normally, but if force is requested (Quota exceeded), clear oldest 20%
  if (force) {
    const movies = Object.entries(data.movies).sort((a, b) => a[1].lastUpdated - b[1].lastUpdated);
    if (movies.length > 0) {
      const toRemove = Math.max(1, Math.floor(movies.length * 0.2));
      for (let i = 0; i < toRemove; i++) {
        delete data.movies[movies[i][0]];
      }
    }
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch(e) {}
};