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

  const railStyle = {
    display: "flex",
    gap: "14px",
    overflowX: "auto",
    overflowY: "hidden",
    paddingBottom: "10px",
    scrollBehavior: "smooth",
    WebkitOverflowScrolling: "touch",
  };

  const sectionTitleStyle = (marginTop = "20px") => ({
    marginTop,
    marginBottom: "14px",
    paddingInline: "2px",
  });

  return (
    <>
      {loading && <Loader />}

      {showCatalog && (movies.length > 0 || series.length > 0 || continueWatchingList.length > 0) && (
        <div className="content-section">
          {/* Continue Watching */}
          {query.trim() === "" && continueWatchingList.length > 0 && (
            <>
              <h2 className="section-title" style={sectionTitleStyle()}>
                ⏯ Continue Watching
              </h2>

              <div style={railStyle}>
                {continueWatchingList.map((item) => (
                  <div key={`cw-${item.type}-${item.type === "movie" ? item.id : item.seriesId}`} style={{ flex: "0 0 auto" }}>
                    <ContinueWatchingCard
                      item={item}
                      onRemove={removeFromContinueWatching}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Trakt Watchlist */}
          {syncMode === "trakt" && query.trim() === "" && watchlist.length > 0 && (
            <>
              <h2
                className="section-title"
                style={sectionTitleStyle(continueWatchingList.length > 0 ? "26px" : "18px")}
              >
                ⭐ Watchlist
              </h2>

              <div style={railStyle}>
                {watchlist.map((item) => (
                  <div key={`wl-${item.type}-${item.id}`} style={{ flex: "0 0 auto" }}>
                    <PosterCard item={item} type={item.type} />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Movies */}
          {movies.length > 0 && (
            <>
              <h2
                className="section-title"
                style={sectionTitleStyle(
                  continueWatchingList.length > 0 || (syncMode === "trakt" && watchlist.length > 0)
                    ? "26px"
                    : "18px"
                )}
              >
                🎬 {query.trim() ? "Movies" : "Trending Movies"}
              </h2>

              <div style={railStyle}>
                {movies.map((item) => (
                  <div key={`movie-${item.id}`} style={{ flex: "0 0 auto" }}>
                    <PosterCard item={item} type="movie" />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Series */}
          {series.length > 0 && (
            <>
              <h2 className="section-title" style={sectionTitleStyle("26px")}>
                📺 {query.trim() ? "Series" : "Trending Series"}
              </h2>

              <div style={railStyle}>
                {series.map((item) => (
                  <div key={`series-${item.id}`} style={{ flex: "0 0 auto" }}>
                    <PosterCard item={item} type="series" />
                  </div>
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
