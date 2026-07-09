import { useCallback, useEffect, useState } from "react";
import { progressService } from "../trackers/progressService.js";

export function useWatchHistory() {
  const [historyList, setHistoryList] = useState([]);

  useEffect(() => {
    let active = true;

    const loadHistory = async () => {
      try {
        const data = await progressService.getHistory();

        if (active) {
          setHistoryList(Array.isArray(data) ? data : []);
        }
      } catch {
        if (active) {
          setHistoryList([]);
        }
      }
    };

    loadHistory();

    // Fires on every local write, including completed items pulled down by
    // Trakt reconciliation, so this list stays current without a refresh.
    window.addEventListener("watch-progress-changed", loadHistory);

    return () => {
      active = false;
      window.removeEventListener("watch-progress-changed", loadHistory);
    };
  }, []);

  const removeFromHistory = useCallback((item) => {
    const id = item.type === "movie" ? item.id : item.seriesId;
    progressService.removeProgress(item.type, id);
  }, []);

  return {
    historyList,
    removeFromHistory,
  };
}
