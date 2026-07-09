import { traktAuth } from "../services/trakt/traktAuth.js";

const SYNC_MODE_KEY = "syncMode";

// The only sanctioned way to read sync mode outside React. SettingsContext
// persists this via storageService.set (JSON.stringify), so it must be
// JSON.parse'd back — a raw localStorage.getItem read here is the exact bug
// that silently disabled Trakt sync previously.
export function getSyncMode() {
  try {
    const raw = localStorage.getItem(SYNC_MODE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed === "trakt" ? "trakt" : "local";
  } catch {
    return "local";
  }
}

export function isTraktSyncEnabled() {
  return getSyncMode() === "trakt" && traktAuth.isAuthenticated();
}
