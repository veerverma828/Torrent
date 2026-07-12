import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAddonCatalogRails } from "../../services/addonCatalogs.js";
import { useAppContext } from "../../context/AppContext.jsx";
import { useSettingsContext } from "../../context/SettingsContext.jsx";
import { useContinueWatching } from "../../hooks/useContinueWatching.js";
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

  const { imdbMode, useJackett, addonApis } = useSettingsContext();
  const { continueWatchingList, removeFromContinueWatching } = useContinueWatching();
  const [addonRails, setAddonRails] = useState([]);

  // Extra Home rails from installed Stremio addons that expose catalogs.
  useEffect(() => {
    let cancelled = false;
    fetchAddonCatalogRails(addonApis)
      .then((rails) => {
        if (!cancelled) setAddonRails(rails);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [addonApis]);

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

  // Stable identity so MediaRail's memo isn't defeated by a fresh closure
  // every HomePage render (e.g. when addonRails/genreRails recompute).
  const renderContinueWatchingCard = useCallback(
    (item) => <ContinueWatchingCard item={item} onRemove={removeFromContinueWatching} />,
    [removeFromContinueWatching]
  );

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
              renderItem={renderContinueWatchingCard}
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

          {addonRails.map((rail) => (
            <MediaRail
              key={rail.key}
              title={rail.title}
              items={rail.metas}
              type={rail.type}
              keyPrefix={rail.key}
            />
          ))}

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
