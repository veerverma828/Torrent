import { getBaseAddonUrl } from "../utils/navigationHelpers.js";
import { storageService } from "./storageService.js";
import { DEFAULT_ADDON_APIS } from "../utils/constants.js";

/**
 * Stremio addon manifest + catalog support.
 *
 * Manifests are validated on save (Settings) and cached in storage under
 * `addonManifests`, keyed by manifest URL. Catalogs from those manifests are
 * surfaced as extra rails on the Home page. Stream fetching keeps using the
 * raw URL list (`addonApis`) exactly as before — this module is additive.
 */

const MANIFESTS_KEY = "addonManifests";
const CATALOG_TTL = 15 * 60 * 1000;
const catalogCache = new Map();

// Catalogs-per-addon cap keeps Home fast even for kitchen-sink addons.
const MAX_CATALOGS_PER_ADDON = 3;
const SUPPORTED_TYPES = new Set(["movie", "series"]);

/** Fetch + validate a Stremio manifest URL. Throws with a readable message. */
export async function fetchAddonManifest(url) {
  const trimmed = (url || "").trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error("Enter a full URL starting with https://");
  }

  const manifestUrl = /manifest\.json$/i.test(trimmed)
    ? trimmed
    : `${trimmed.replace(/\/$/, "")}/manifest.json`;

  let res;
  try {
    res = await fetch(manifestUrl);
  } catch {
    throw new Error("Could not reach the addon (network/CORS error)");
  }
  if (!res.ok) throw new Error(`Addon returned HTTP ${res.status}`);

  let manifest;
  try {
    manifest = await res.json();
  } catch {
    throw new Error("URL did not return valid JSON — is it a manifest link?");
  }

  if (!manifest.id || !Array.isArray(manifest.resources)) {
    throw new Error("Not a valid Stremio manifest (missing id/resources)");
  }

  return {
    url: manifestUrl,
    id: manifest.id,
    name: manifest.name || manifest.id,
    description: manifest.description || "",
    resources: manifest.resources.map((r) => (typeof r === "string" ? r : r.name)),
    types: manifest.types || [],
    catalogs: (manifest.catalogs || [])
      .filter((c) => SUPPORTED_TYPES.has(c.type))
      // Skip catalogs that require extra parameters (search/genre) — only
      // plain top-level catalogs can be fetched without user input.
      .filter((c) => !(c.extra || []).some((e) => e.isRequired))
      .map((c) => ({ type: c.type, id: c.id, name: c.name || c.id })),
  };
}

export function getStoredManifests() {
  return storageService.get(MANIFESTS_KEY) || {};
}

export function storeManifest(info) {
  const all = getStoredManifests();
  all[info.url] = info;
  storageService.set(MANIFESTS_KEY, all);
}

export function pruneManifests(activeUrls) {
  const all = getStoredManifests();
  const next = {};
  for (const u of activeUrls) if (all[u]) next[u] = all[u];
  storageService.set(MANIFESTS_KEY, next);
}

/**
 * All addon catalog rails for the Home page:
 * [{ key, title, type, metas }]
 * Default addons (Torrentio) are skipped — they're stream-only.
 */
export async function fetchAddonCatalogRails(addonApis) {
  const manifests = getStoredManifests();
  const rails = [];

  const jobs = [];
  for (const api of addonApis || []) {
    if (DEFAULT_ADDON_APIS.includes(api)) continue;
    const info = manifests[api] || manifests[`${api.replace(/\/$/, "")}/manifest.json`];
    if (!info?.catalogs?.length) continue;

    const base = getBaseAddonUrl(info.url);
    for (const cat of info.catalogs.slice(0, MAX_CATALOGS_PER_ADDON)) {
      const url = `${base}/catalog/${encodeURIComponent(cat.type)}/${encodeURIComponent(cat.id)}.json`;
      jobs.push(
        fetchCatalog(url)
          .then((metas) => {
            if (metas.length > 0) {
              rails.push({
                key: `${info.id}-${cat.type}-${cat.id}`,
                title: `${info.name} · ${cat.name}`,
                type: cat.type,
                metas,
              });
            }
          })
          .catch(() => {}) // one broken catalog never blocks the rest
      );
    }
  }

  await Promise.all(jobs);
  return rails;
}

async function fetchCatalog(url) {
  const now = Date.now();
  const cached = catalogCache.get(url);
  if (cached && now - cached.timestamp < CATALOG_TTL) return cached.data;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`catalog ${res.status}`);
  const data = await res.json();

  // Existing routes only understand imdb-style ids (tt...) — skip the rest.
  const metas = (data.metas || []).filter((m) => /^tt\d+/.test(m.id || ""));
  catalogCache.set(url, { data: metas, timestamp: now });
  return metas;
}
