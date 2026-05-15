import { useEffect, useState } from "react";

export function useTraktWatchlist(enabled = true) {
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setWatchlist([]);
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);

    import("../trackers/providers/traktProvider.js")
      .then(({ traktProvider }) => traktProvider.getWatchlist())
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
  }, [enabled]);

  return { watchlist, loading };
}
