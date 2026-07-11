/**
 * Real per-episode ratings via TVMaze (free, no API key, CORS-enabled).
 * Cinemeta's videos[] carries rating "0" for everything, so this is the only
 * keyless source of genuine episode scores. Cached aggressively — ratings
 * barely change.
 */
const CACHE_KEY_PREFIX = "epRatings:";
const TTL = 24 * 60 * 60 * 1000; // 1 day

function readCache(imdbId) {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + imdbId);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > TTL) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(imdbId, data) {
  try {
    localStorage.setItem(CACHE_KEY_PREFIX + imdbId, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // storage full — fine, just uncached
  }
}

/** Returns { "season:episode": rating } or {} on any failure. */
export async function fetchEpisodeRatings(imdbId) {
  if (!/^tt\d+/.test(imdbId || "")) return {};

  const cached = readCache(imdbId);
  if (cached) return cached;

  try {
    const showRes = await fetch(`https://api.tvmaze.com/lookup/shows?imdb=${imdbId}`);
    if (!showRes.ok) return {};
    const show = await showRes.json();
    if (!show?.id) return {};

    const epsRes = await fetch(`https://api.tvmaze.com/shows/${show.id}/episodes`);
    if (!epsRes.ok) return {};
    const eps = await epsRes.json();

    const map = {};
    for (const ep of eps) {
      const score = ep?.rating?.average;
      if (score > 0) map[`${ep.season}:${ep.number}`] = score;
    }
    writeCache(imdbId, map);
    return map;
  } catch {
    return {};
  }
}
