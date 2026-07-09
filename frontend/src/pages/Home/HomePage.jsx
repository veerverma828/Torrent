import { memo, useEffect } from "react";
import { motion } from "framer-motion";
import { useAppContext } from "../../context/AppContext.jsx";
import { useSettingsContext } from "../../context/SettingsContext.jsx";
import { useContinueWatching } from "../../hooks/useContinueWatching.js";
import { useTraktWatchlist } from "../../hooks/useTraktWatchlist.js";
import Loader from "../../components/common/Loader.jsx";
import PosterCard from "../../components/cards/PosterCard.jsx";
import ContinueWatchingCard from "../../components/cards/ContinueWatchingCard.jsx";
import ResultCard from "../../components/cards/ResultCard.jsx";

const railVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};

const railItemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

const MediaRail = memo(function MediaRail({ title, items, type }) {
  if (!items?.length) return null;

  return (
    <>
      <h2 className="section-title">{title}</h2>

      <motion.div
        className="media-rail"
        variants={railVariants}
        initial="hidden"
        animate="visible"
      >
        {items.map((item) => (
          <motion.div
            key={`${title}-${item.id}`}
            className="media-rail-item"
            variants={railItemVariants}
            transition={{ duration: 0.25 }}
          >
            <PosterCard item={item} type={type} />
          </motion.div>
        ))}
      </motion.div>
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

              <motion.div
                className="media-rail"
                variants={railVariants}
                initial="hidden"
                animate="visible"
              >
                {continueWatchingList.map((item) => (
                  <motion.div
                    key={`cw-${item.type}-${item.type === "movie" ? item.id : item.seriesId}`}
                    className="media-rail-item"
                    variants={railItemVariants}
                    transition={{ duration: 0.25 }}
                  >
                    <ContinueWatchingCard item={item} onRemove={removeFromContinueWatching} />
                  </motion.div>
                ))}
              </motion.div>
            </>
          )}

          {syncMode === "trakt" && trimmedQuery === "" && watchlist.length > 0 && (
            <>
              <h2 className="section-title">Watchlist</h2>

              <motion.div
                className="media-rail"
                variants={railVariants}
                initial="hidden"
                animate="visible"
              >
                {watchlist.map((item) => (
                  <motion.div
                    key={`wl-${item.type}-${item.id}`}
                    className="media-rail-item"
                    variants={railItemVariants}
                    transition={{ duration: 0.25 }}
                  >
                    <PosterCard item={item} type={item.type} />
                  </motion.div>
                ))}
              </motion.div>
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
