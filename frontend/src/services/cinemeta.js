import { CINEMETA_BASE } from "../utils/constants.js";
import { getBaseAddonUrl } from "../utils/navigationHelpers.js";
import { formatTorrentio } from "../utils/streamHelpers.js";

export async function searchMovies(query) {
  const res = await fetch(`${CINEMETA_BASE}/catalog/movie/top/search=${query}.json`);
  const data = await res.json();
  return data.metas || [];
}

export async function searchSeries(query) {
  const res = await fetch(`${CINEMETA_BASE}/catalog/series/top/search=${query}.json`);
  const data = await res.json();
  return data.metas || [];
}

export async function fetchSeriesMeta(id) {
  const res = await fetch(`${CINEMETA_BASE}/meta/series/${id}.json`);
  const data = await res.json();
  return data.meta;
}

export async function fetchMovieStreams(id, addonApis) {
  const fetchPromises = addonApis.map((api) => {
    const baseUrl = getBaseAddonUrl(api);
    return fetch(`${baseUrl}/stream/movie/${id}.json`)
      .then((r) => r.json())
      .catch(() => ({ streams: [] }));
  });
  const dataArray = await Promise.all(fetchPromises);
  return dataArray.flatMap((data) => formatTorrentio(data));
}

export async function fetchEpisodeStreams(id, season, episode, addonApis) {
  const fetchPromises = addonApis.map((api) => {
    const baseUrl = getBaseAddonUrl(api);
    return fetch(`${baseUrl}/stream/series/${id}:${season}:${episode}.json`)
      .then((r) => r.json())
      .catch(() => ({ streams: [] }));
  });
  const dataArray = await Promise.all(fetchPromises);
  return dataArray.flatMap((data) => formatTorrentio(data));
}

export async function fetchDefaultCatalog() {
  const [movieRes, seriesRes] = await Promise.all([
    fetch(`${CINEMETA_BASE}/catalog/movie/top.json`).then((r) => r.json()),
    fetch(`${CINEMETA_BASE}/catalog/series/top.json`).then((r) => r.json()),
  ]);
  return {
    movies: movieRes.metas || [],
    series: seriesRes.metas || [],
  };
}

export async function fetchMeta(type, id) {
  const res = await fetch(`${CINEMETA_BASE}/meta/${type}/${id}.json`);
  const data = await res.json();
  return data.meta || null;
}
