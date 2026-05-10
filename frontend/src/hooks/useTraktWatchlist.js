import { useEffect, useState } from "react";
import { traktProvider } from "../trackers/providers/traktProvider.js";

export function useTraktWatchlist() {
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);

    traktProvider
      .getWatchlist()
      .then((data) => {
        if (active) setWatchlist(data);
      })
      .catch(() => {
        if (active) setWatchlist([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { watchlist, loading };
}
