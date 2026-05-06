import { useCallback } from "react";
import { useAppContext } from "../context/AppContext.jsx";
import { getContinueWatching, removeProgress } from "../trackers/progressTracker.js";

export function useContinueWatching() {
  const { cwTrigger, setCwTrigger } = useAppContext();

  const continueWatchingList = getContinueWatching();

  const removeFromContinueWatching = useCallback(
    (item) => {
      const id = item.type === "movie" ? item.id : item.seriesId;
      removeProgress(item.type, id);
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
