export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const CINEMETA_BASE = "https://v3-cinemeta.strem.io";

export const DEFAULT_ADDON_APIS = ["https://torrentio.strem.fun/manifest.json"];

export const DEFAULT_DEBRID_SERVICE = "torbox";

export const STORAGE_KEYS = {
  ADDON_APIS: "addonApis",
  WATCH_PROGRESS: "watch_progress",
};

// "Is this item finished" — drives the `completed` flag on movies/episodes.
export const WATCH_COMPLETED_PERCENTAGE = 90;

// "So close to the end, don't bother seeking on resume" — deliberately a
// separate, later cutoff than WATCH_COMPLETED_PERCENTAGE.
export const RESUME_SKIP_THRESHOLD = 95;
