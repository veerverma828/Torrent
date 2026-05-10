import { useEffect } from "react";
import { useAppContext } from "../../context/AppContext.jsx";
import { useSettingsContext } from "../../context/SettingsContext.jsx";
import { useContinueWatching } from "../../hooks/useContinueWatching.js";
import { useTraktWatchlist } from "../../hooks/useTraktWatchlist.js";
import Loader from "../../components/common/Loader.jsx";
import PosterCard from "../../components/cards/PosterCard.jsx";
import ContinueWatchingCard from "../../components/cards/ContinueWatchingCard.jsx";
import ResultCard from "../../components/cards/ResultCard.jsx";

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
  const { watchlist } = useTraktWatchlist();

  // Cleanup states from other pages on mount
  useEffect(() => {
    if (selectedItem !== null) {
      setSelectedItem(null);
      if (!useJackett && !imdbMode) setResults([]);
    }
    setSeasons([]);
    setEpisodes([]);
    setSelectedSeason(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showCatalog = !imdbMode && !selectedItem && results.length === 0;

  return (
    <>
      {loading && <Loader />}

      {showCatalog && (movies.length > 0 || series.length > 0 || continueWatchingList.length > 0) && (
        <div className="content-section">
          {/* Continue Watching */}
          {query.trim() === "" && continueWatchingList.length > 0 && (
            <>
              <h2 className="section-title">⏯ Continue Watching</h2>
              <div className="poster-grid">
                {continueWatchingList.map((item) => (
                  <ContinueWatchingCard
                    key={`cw-${item.type}-${item.type === "movie" ? item.id : item.seriesId}`}
                    item={item}
                    onRemove={removeFromContinueWatching}
                  />
                ))}
              </div>
            </>
          )}

          {/* Trakt Watchlist */}
          {syncMode === "trakt" && query.trim() === "" && watchlist.length > 0 && (
            <>
              <h2 className="section-title" style={{ marginTop: continueWatchingList.length > 0 ? "30px" : "20px" }}>
                ⭐ Trakt Watchlist
              </h2>
              <div className="poster-grid">
                {watchlist.map((item) => (
                  <PosterCard key={`wl-${item.type}-${item.id}`} item={item} type={item.type} />
                ))}
              </div>
            </>
          )}

          {/* Movies */}
          {movies.length > 0 && (
            <>
              <h2
                className="section-title"
                style={{ marginTop: (continueWatchingList.length > 0 || (syncMode === "trakt" && watchlist.length > 0)) ? "30px" : "20px" }}
              >
                🎬 {query.trim() ? "Movies" : "Top Movies"}
              </h2>
              <div className="poster-grid">
                {movies.map((item) => (
                  <PosterCard key={`movie-${item.id}`} item={item} type="movie" />
                ))}
              </div>
            </>
          )}

          {/* Series */}
          {series.length > 0 && (
            <>
              <h2 className="section-title" style={{ marginTop: "30px" }}>
                📺 {query.trim() ? "Series" : "Top Series"}
              </h2>
              <div className="poster-grid">
                {series.map((item) => (
                  <PosterCard key={`series-${item.id}`} item={item} type="series" />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {(imdbMode || results.length > 0) && (
        <div className="results-container">
          {results.map((item, index) => (
            <ResultCard
              key={`${item.infoHash || item.magnet || 'no-hash'}-${item.title || 'no-title'}-${index}`}
              item={item}
              index={index}
            />
          ))}
        </div>
      )}
    </>
  );
}
