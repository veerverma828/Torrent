import { useCallback, useEffect, useState } from "react";
import { progressService } from "../trackers/progressService.js";

export function useContinueWatching() {
  const [continueWatchingList, setContinueWatchingList] = useState([]);

  useEffect(() => {
    let active = true;

    const loadContinueWatching = async () => {
      try {
        const data = await progressService.getContinueWatching();

        if (active) {
          setContinueWatchingList(Array.isArray(data) ? data : []);
        }
      } catch {
        if (active) {
          setContinueWatchingList([]);
        }
      }
    };

    loadContinueWatching();

    // progressTracker dispatches this on every local write, whether it came
    // from this tab's own playback or a background Trakt reconciliation —
    // so a mounted Continue Watching list always reflects the latest state.
    window.addEventListener("watch-progress-changed", loadContinueWatching);

    return () => {
      active = false;
      window.removeEventListener("watch-progress-changed", loadContinueWatching);
    };
  }, []);

  const removeFromContinueWatching = useCallback((item) => {
    const id = item.type === "movie" ? item.id : item.seriesId;
    progressService.removeProgress(item.type, id);
  }, []);

  return {
    continueWatchingList,
    removeFromContinueWatching,
  };
}
