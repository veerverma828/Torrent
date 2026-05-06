import { useCallback } from "react";
import { useAppContext } from "../context/AppContext.jsx";
import { progressService } from "../trackers/progressService.js";

export function useContinueWatching() {
  const { cwTrigger, setCwTrigger } = useAppContext();

  const continueWatchingList = progressService.getContinueWatching();

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
