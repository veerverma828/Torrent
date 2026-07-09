import { CINEMETA_BASE } from "../utils/constants.js";
import { getBaseAddonUrl } from "../utils/navigationHelpers.js";
import { formatTorrentio } from "../utils/streamHelpers.js";

const CACHE_TTL = 5 * 60 * 1000;
const STREAM_CACHE_TTL = 60 * 1000;
const CATALOG_STORAGE_TTL = 15 * 60 * 1000;
const responseCache = new Map();

function readCatalogStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CATALOG_STORAGE_TTL) return null;

    return data;
  } catch {
    return null;
  }
}

function writeCatalogStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // storage full or unavailable — skip caching silently
  }
}

async function fetchJson(url, { signal, ttl = CACHE_TTL } = {}) {
  const now = Date.now();
  const cached = responseCache.get(url);

  if (cached && now - cached.timestamp < ttl) {
    return cached.data;
  }

  const res = await fetch(url, { signal });

  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }

  const data = await res.json();
  responseCache.set(url, { data, timestamp: now });

  return data;
}

const encodePathPart = (value) => encodeURIComponent(String(value).trim());

export async function searchMovies(query, options = {}) {
  const encodedQuery = encodePathPart(query);
  const data = await fetchJson(
    `${CINEMETA_BASE}/catalog/movie/top/search=${encodedQuery}.json`,
    options
  );
  return data.metas || [];
}

export async function searchSeries(query, options = {}) {
  const encodedQuery = encodePathPart(query);
  const data = await fetchJson(
    `${CINEMETA_BASE}/catalog/series/top/search=${encodedQuery}.json`,
    options
  );
  return data.metas || [];
}

export async function fetchSeriesMeta(id) {
  const data = await fetchJson(`${CINEMETA_BASE}/meta/series/${encodePathPart(id)}.json`);
  return data.meta;
}

async function fetchAddonStreams(url) {
  try {
    const data = await fetchJson(url, { ttl: STREAM_CACHE_TTL });
    return formatTorrentio(data);
  } catch {
    return [];
  }
}

export async function fetchMovieStreams(id, addonApis) {
  const fetchPromises = addonApis.map((api) => {
    const baseUrl = getBaseAddonUrl(api);
    return fetchAddonStreams(`${baseUrl}/stream/movie/${encodePathPart(id)}.json`);
  });
  const dataArray = await Promise.all(fetchPromises);
  return dataArray.flat();
}

export async function fetchEpisodeStreams(id, season, episode, addonApis) {
  const fetchPromises = addonApis.map((api) => {
    const baseUrl = getBaseAddonUrl(api);
    return fetchAddonStreams(
      `${baseUrl}/stream/series/${encodePathPart(id)}:${encodePathPart(season)}:${encodePathPart(episode)}.json`
    );
  });
  const dataArray = await Promise.all(fetchPromises);
  return dataArray.flat();
}

export async function fetchCatalog(type, category) {
  const data = await fetchJson(
    `${CINEMETA_BASE}/catalog/${encodePathPart(type)}/${encodePathPart(category)}.json`
  );
  return data.metas || [];
}

export async function fetchDefaultMovies() {
  const storageKey = "cinemeta:movies:top";
  const cached = readCatalogStorage(storageKey);
  if (cached) return cached;

  const data = await fetchJson(`${CINEMETA_BASE}/catalog/movie/top.json`);
  const metas = data.metas || [];
  writeCatalogStorage(storageKey, metas);
  return metas;
}

export async function fetchDefaultSeries() {
  const storageKey = "cinemeta:series:top";
  const cached = readCatalogStorage(storageKey);
  if (cached) return cached;

  const data = await fetchJson(`${CINEMETA_BASE}/catalog/series/top.json`);
  const metas = data.metas || [];
  writeCatalogStorage(storageKey, metas);
  return metas;
}

export async function fetchMeta(type, id) {
  const data = await fetchJson(
    `${CINEMETA_BASE}/meta/${encodePathPart(type)}/${encodePathPart(id)}.json`
  );
  return data.meta || null;
}
