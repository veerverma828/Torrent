import { useCallback, useEffect, useState } from "react";
import { useAppContext } from "../context/AppContext.jsx";
import { progressService } from "../trackers/progressService.js";

export function useContinueWatching() {
  const { cwTrigger, setCwTrigger } = useAppContext();

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

    return () => {
      active = false;
    };
  }, [cwTrigger]);

  const removeFromContinueWatching = useCallback(
    (item) => {
      const id = item.type === "movie" ? item.id : item.seriesId;

      progressService.removeProgress(item.type, id);

      setCwTrigger((prev) => prev + 1);
    },
    [setCwTrigger]
  );

  return {
    continueWatchingList,
    cwTrigger,
    removeFromContinueWatching,
  };
}
