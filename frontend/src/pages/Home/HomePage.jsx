import { memo, useEffect } from "react";
import { useAppContext } from "../../context/AppContext.jsx";
import { useSettingsContext } from "../../context/SettingsContext.jsx";
import { useContinueWatching } from "../../hooks/useContinueWatching.js";
import { useTraktWatchlist } from "../../hooks/useTraktWatchlist.js";
import Loader from "../../components/common/Loader.jsx";
import PosterCard from "../../components/cards/PosterCard.jsx";
import ContinueWatchingCard from "../../components/cards/ContinueWatchingCard.jsx";
import ResultCard from "../../components/cards/ResultCard.jsx";

const MediaRail = memo(function MediaRail({ title, items, type }) {
  if (!items?.length) return null;

  return (
    <>
      <h2 className="section-title">{title}</h2>

      <div className="media-rail">
        {items.map((item) => (
          <div key={`${title}-${item.id}`} className="media-rail-item">
            <PosterCard item={item} type={type} />
          </div>
        ))}
      </div>
    </>
  );
});

export default function HomePage() {
  const {
    movies,
    series,
    results,
    loading,
    selectedItem,
    setSelectedItem,
    setSeasons,
    setEpisodes,
    setSelectedSeason,
    setResults,
    query,
  } = useAppContext();

  const { imdbMode, useJackett, syncMode } = useSettingsContext();
  const { continueWatchingList, removeFromContinueWatching } = useContinueWatching();
  const { watchlist } = useTraktWatchlist(syncMode === "trakt");

  useEffect(() => {
    if (selectedItem !== null) {
      setSelectedItem(null);
      if (!useJackett && !imdbMode) setResults([]);
    }

    setSeasons([]);
    setEpisodes([]);
    setSelectedSeason(null);
  }, []);

  const trimmedQuery = query.trim();
  const showCatalog = !imdbMode && !selectedItem && results.length === 0;

  return (
    <>
      {loading && <Loader />}

      {showCatalog && (
        <div className="content-section">
          {trimmedQuery === "" && continueWatchingList.length > 0 && (
            <>
              <h2 className="section-title">
                Continue Watching
              </h2>

              <div className="media-rail">
                {continueWatchingList.map((item) => (
                  <div
                    key={`cw-${item.type}-${item.type === "movie" ? item.id : item.seriesId}`}
                    className="media-rail-item"
                  >
                    <ContinueWatchingCard item={item} onRemove={removeFromContinueWatching} />
                  </div>
                ))}
              </div>
            </>
          )}

          {syncMode === "trakt" && trimmedQuery === "" && watchlist.length > 0 && (
            <>
              <h2 className="section-title">
                Watchlist
              </h2>

              <div className="media-rail">
                {watchlist.map((item) => (
                  <div key={`wl-${item.type}-${item.id}`} className="media-rail-item">
                    <PosterCard item={item} type={item.type} />
                  </div>
                ))}
              </div>
            </>
          )}

          <MediaRail title={trimmedQuery ? "Movies" : "Trending Movies"} items={movies} type="movie" />

          <MediaRail title={trimmedQuery ? "Series" : "Trending Series"} items={series} type="series" />
        </div>
      )}

      {(imdbMode || results.length > 0) && (
        <div className="results-container">
          {results.map((item, index) => (
            <ResultCard
              key={`${item.infoHash || item.magnet || "no-hash"}-${item.title || "no-title"}-${index}`}
              item={item}
              index={index}
            />
          ))}
        </div>
      )}
    </>
  );
}
