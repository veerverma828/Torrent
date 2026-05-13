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
    popularMovies,
    popularSeries,
    recentMovies,
    recentSeries,
    topRatedMovies,
    topRatedSeries,
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
    gap: "10px",
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

  const renderRail = (title, items, type) => {
    if (!items?.length) return null;

    return (
      <>
        <h2 className="section-title" style={sectionTitleStyle("26px")}>
          {title}
        </h2>

        <div style={railStyle}>
          {items.map((item) => (
            <div key={`${title}-${item.id}`} style={{ flex: "0 0 auto" }}>
              <PosterCard item={item} type={type} />
            </div>
          ))}
        </div>
      </>
    );
  };

  return (
    <>
      {loading && <Loader />}

      {showCatalog && (
        <div className="content-section">
          {/* Continue Watching */}
          {query.trim() === "" && continueWatchingList.length > 0 && (
            <>
              <h2 className="section-title" style={sectionTitleStyle()}>
                ⏯ Continue Watching
              </h2>

              <div style={railStyle}>
                {continueWatchingList.map((item) => (
                  <div
                    key={`cw-${item.type}-${item.type === "movie" ? item.id : item.seriesId}`}
                    style={{ flex: "0 0 auto" }}
                  >
                    <ContinueWatchingCard
                      item={item}
                      onRemove={removeFromContinueWatching}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Watchlist */}
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

          {renderRail(
            `🎬 ${query.trim() ? "Movies" : "Trending Movies"}`,
            movies,
            "movie"
          )}

          {renderRail(
            `📺 ${query.trim() ? "Series" : "Trending Series"}`,
            series,
            "series"
          )}

          {query.trim() === "" && (
            <>
              {renderRail("🔥 Popular Movies", popularMovies, "movie")}
              {renderRail("⭐ Popular Series", popularSeries, "series")}
              {renderRail("🆕 Recently Released Movies", recentMovies, "movie")}
              {renderRail("📡 Recently Aired Series", recentSeries, "series")}
              {renderRail("🏆 Top Rated Movies", topRatedMovies, "movie")}
              {renderRail("👑 Top Rated Series", topRatedSeries, "series")}
            </>
          )}
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
