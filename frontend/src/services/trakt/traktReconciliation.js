/**
 * Pulls Trakt's server-side state (in-progress playback + recent history)
 * down into the local watch_progress store on page load, tab focus, and a
 * light interval — the one-directional counterpart to traktSyncQueue's
 * local-to-Trakt push. UI code never calls Trakt directly; this is the only
 * thing that writes remote data into progressTracker.
 */
import { traktProvider, mapPlaybackItemToLocal, mapHistoryItemToLocal } from "../../trackers/providers/traktProvider.js";
import { mergeRemoteMovieProgress, mergeRemoteEpisodeProgress } from "../../trackers/progressTracker.js";
import { isTraktSyncEnabled } from "../../utils/syncMode.js";

const LAST_SYNC_KEY = "trakt_last_sync";
const FOCUS_THROTTLE_MS = 60 * 1000;
const INTERVAL_MS = 3 * 60 * 1000;

let intervalId = null;
let visibilityHandler = null;
let lastReconcileAt = 0;

function applyMapped(mapped) {
  if (!mapped) return;

  if (mapped.kind === "movie") {
    if (!mapped.id) return;
    mergeRemoteMovieProgress(mapped.id, mapped.remote);
  } else if (mapped.kind === "episode") {
    if (!mapped.seriesId || mapped.season == null || mapped.episode == null) return;
    mergeRemoteEpisodeProgress(mapped.seriesId, mapped.season, mapped.episode, mapped.remote, mapped.seriesMeta);
  }
}

// History can contain multiple watch events per item (rewatches); keep only
// the most recent one per unique movie/episode key before merging.
function latestPerKey(mappedItems) {
  const byKey = new Map();

  for (const mapped of mappedItems) {
    if (!mapped) continue;
    const key =
      mapped.kind === "movie"
        ? `movie-${mapped.id}`
        : `episode-${mapped.seriesId}-${mapped.season}-${mapped.episode}`;

    const existing = byKey.get(key);
    if (!existing || mapped.remote.lastUpdated > existing.remote.lastUpdated) {
      byKey.set(key, mapped);
    }
  }

  return [...byKey.values()];
}

export const traktReconciliation = {
  async reconcileNow({ trigger = "manual" } = {}) {
    if (!isTraktSyncEnabled()) return;

    try {
      console.log(`[TraktReconciliation] Starting (${trigger})`);

      const playbackItems = await traktProvider.fetchPlaybackItems();
      playbackItems.map(mapPlaybackItemToLocal).forEach(applyMapped);

      const [movieHistory, episodeHistory] = await Promise.all([
        traktProvider.fetchHistory({ type: "movies", limit: 50 }),
        traktProvider.fetchHistory({ type: "episodes", limit: 50 }),
      ]);

      const mappedHistory = latestPerKey([
        ...movieHistory.map(mapHistoryItemToLocal),
        ...episodeHistory.map(mapHistoryItemToLocal),
      ]);
      mappedHistory.forEach(applyMapped);

      localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
      lastReconcileAt = Date.now();
      console.log("[TraktReconciliation] Done");
    } catch (error) {
      // Never throw — local storage stays authoritative until the next
      // attempt succeeds.
      console.error("[TraktReconciliation] Failed:", error);
    }
  },

  startAutoReconcile() {
    this.stopAutoReconcile();

    visibilityHandler = () => {
      if (document.hidden) return;
      if (Date.now() - lastReconcileAt < FOCUS_THROTTLE_MS) return;
      this.reconcileNow({ trigger: "focus" });
    };
    document.addEventListener("visibilitychange", visibilityHandler);

    intervalId = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      this.reconcileNow({ trigger: "interval" });
    }, INTERVAL_MS);
  },

  stopAutoReconcile() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (visibilityHandler) {
      document.removeEventListener("visibilitychange", visibilityHandler);
      visibilityHandler = null;
    }
  },

  getLastSyncedAt() {
    const raw = localStorage.getItem(LAST_SYNC_KEY);
    return raw ? Number(raw) : null;
  },
};
