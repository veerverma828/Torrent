import { useEffect, useMemo } from "react";
import { useAppContext } from "../../context/AppContext.jsx";
import { useSettingsContext } from "../../context/SettingsContext.jsx";
import { useContinueWatching } from "../../hooks/useContinueWatching.js";
import { useWatchHistory } from "../../hooks/useWatchHistory.js";
import { groupByGenre } from "../../utils/mediaGrouping.js";
import Loader from "../../components/common/Loader.jsx";
import ContinueWatchingCard from "../../components/cards/ContinueWatchingCard.jsx";
import ResultCard from "../../components/cards/ResultCard.jsx";
import HeroBanner from "../../components/home/HeroBanner.jsx";
import MediaRail from "../../components/home/MediaRail.jsx";
import SkeletonRail from "../../components/home/SkeletonRail.jsx";

export default function HomePage() {
  const {
    movies,
    series,
    results,
    loading,
    moviesLoading,
    seriesLoading,
    selectedItem,
    setSelectedItem,
    setSeasons,
    setEpisodes,
    setSelectedSeason,
    setResults,
    query,
  } = useAppContext();

  const { imdbMode, useJackett } = useSettingsContext();
  const { continueWatchingList, removeFromContinueWatching } = useContinueWatching();
  const { historyList, removeFromHistory } = useWatchHistory();

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
  const isBrowsing = trimmedQuery === "";

  const genreRails = useMemo(() => {
    if (!isBrowsing) return [];
    return groupByGenre([...movies, ...series]);
  }, [isBrowsing, movies, series]);

  return (
    <>
      {loading && <Loader />}

      {showCatalog && isBrowsing && <HeroBanner />}

      {showCatalog && (
        <div className="content-section">
          {trimmedQuery === "" && continueWatchingList.length > 0 && (
            <MediaRail
              title="Continue Watching"
              items={continueWatchingList}
              keyPrefix="cw"
              renderItem={(item) => (
                <ContinueWatchingCard item={item} onRemove={removeFromContinueWatching} />
              )}
            />
          )}

          {trimmedQuery === "" && historyList.length > 0 && (
            <MediaRail
              title="History"
              items={historyList}
              keyPrefix="history"
              renderItem={(item) => (
                <ContinueWatchingCard item={item} onRemove={removeFromHistory} />
              )}
            />
          )}

          {moviesLoading ? (
            <SkeletonRail title={trimmedQuery ? "Movies" : "Trending Movies"} />
          ) : (
            <MediaRail
              title={trimmedQuery ? "Movies" : "Trending Movies"}
              items={movies}
              type="movie"
              keyPrefix="movies"
            />
          )}

          {seriesLoading ? (
            <SkeletonRail title={trimmedQuery ? "Series" : "Trending Series"} />
          ) : (
            <MediaRail
              title={trimmedQuery ? "Series" : "Trending Series"}
              items={series}
              type="series"
              keyPrefix="series"
            />
          )}

          {genreRails.map(({ genre, items }) => (
            <MediaRail key={genre} title={genre} items={items} keyPrefix={`genre-${genre}`} />
          ))}
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
