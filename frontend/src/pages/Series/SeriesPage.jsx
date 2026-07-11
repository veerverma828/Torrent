import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Film, Cable, ChevronLeft, ChevronRight } from "lucide-react";
import { useAppContext } from "../../context/AppContext.jsx";
import { useSettingsContext } from "../../context/SettingsContext.jsx";
import { useStreamActions } from "../../hooks/useStreamActions.js";
import { useSeasonScroll } from "../../hooks/useSeasonScroll.js";
import { fetchSeriesMeta, fetchEpisodeStreams } from "../../services/cinemeta.js";
import { fetchEpisodeRatings } from "../../services/episodeRatings.js";
import Loader from "../../components/common/Loader.jsx";
import ResultCard from "../../components/cards/ResultCard.jsx";
import EpisodeCard from "../../components/cards/EpisodeCard.jsx";
import "./SeriesPage.css";

// Entry stagger removed for speed — long episode lists took ~1s+ to reveal.

export default function SeriesPage() {
  const { id, season: seasonParam, episode: episodeParam } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const {
    selectedItem,
    setSelectedItem,
    seasons,
    setSeasons,
    episodes,
    setEpisodes,
    selectedSeason,
    setSelectedSeason,
    results,
    setResults,
    setLoading,
    loading,
  } = useAppContext();

  const { addonApis, imdbMode } = useSettingsContext();
  const { initAction } = useStreamActions();
  const {
    seasonBarRef,
    canScrollLeft,
    canScrollRight,
    checkScroll,
    scrollSeasons,
  } = useSeasonScroll();

  const [meta, setMeta] = useState(null);
  const [imageError, setImageError] = useState(false);
  const [episodeRatings, setEpisodeRatings] = useState({});

  // Real per-episode ratings (TVMaze) — Cinemeta only ever sends "0".
  useEffect(() => {
    let cancelled = false;
    fetchEpisodeRatings(id).then((map) => {
      if (!cancelled) setEpisodeRatings(map);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Use ref to avoid stale closure for initAction in effect
  const initActionRef = useRef(initAction);
  initActionRef.current = initAction;

  const visibleEpisodes = useMemo(() => {
    if (selectedSeason === null || selectedSeason === undefined) return [];
    return episodes.filter((ep) => Number(ep.season) === Number(selectedSeason));
  }, [episodes, selectedSeason]);

  // Trigger checkScroll when seasons or selectedSeason change
  useEffect(() => {
    const timeout = setTimeout(checkScroll, 100);
    return () => clearTimeout(timeout);
  }, [seasons, selectedSeason, checkScroll]);

  // Fetch series metadata and cache in local state
  useEffect(() => {
    fetchSeriesMeta(id)
      .then((data) => {
        if (data) {
          setMeta(data);

          // Hydrate seasons and episodes if not already done
          if (episodes.length === 0) {
            const videos = data.videos || [];

            const extractedSeasons = [
              ...new Set(
                videos
                  .filter((v) => v.season !== undefined && v.season !== null)
                  .filter((v) => {
                    if (Number(v.season) !== 0) return true;
                    return videos.some(
                      (ep) =>
                        Number(ep.season) === 0 &&
                        ep.episode !== undefined &&
                        ep.episode !== null
                    );
                  })
                  .map((v) => Number(v.season))
              ),
            ].sort((a, b) => {
              if (a === 0) return 1;
              if (b === 0) return -1;
              return a - b;
            });

            setSeasons(extractedSeasons);
            setEpisodes(videos);

            const isEpisodePath = !!(seasonParam && episodeParam);
            if (extractedSeasons.length > 0 && !isEpisodePath) {
              const hasSeason1 = extractedSeasons.some((s) => Number(s) === 1);
              setSelectedSeason(hasSeason1 ? 1 : extractedSeasons[0]);
            }
          }
        }
      })
      .catch((e) => {
        console.error("Failed to fetch series meta:", e);
      });
  }, [id]);

  useEffect(() => {
    const stateItem = location.state?.item;
    const autoPlayMagnet = location.state?.autoPlayMagnet;
    const isEpisodePath = !!(seasonParam && episodeParam);

    setSelectedItem(
      stateItem || {
        id,
        name: isEpisodePath ? `Season ${seasonParam} Ep ${episodeParam}` : "Series",
        type: "series",
      }
    );

    if (autoPlayMagnet) {
      navigate(location.pathname, {
        state: { ...location.state, autoPlayMagnet: null },
        replace: true,
      });
      initActionRef.current(autoPlayMagnet, "stream", true);
    }

    if (isEpisodePath) {
      setSelectedSeason(Number(seasonParam));
    }

    // If on episode path, fetch streams
    if (isEpisodePath) {
      setLoading(true);
      fetchEpisodeStreams(id, seasonParam, episodeParam, addonApis)
        .then((streams) => {
          setResults(streams);
          setLoading(false);

          // Scroll smoothly to the episode streams list
          setTimeout(() => {
            const el = document.querySelector(".selected-episode-streams");
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }, 300);
        })
        .catch((e) => {
          console.error(e);
          setLoading(false);
        });
    } else {
      setResults([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, seasonParam, episodeParam, addonApis, location.pathname]);

  const isEpisodePath = !!(seasonParam && episodeParam);

  return (
    <div className="series-page-wrapper" style={{ padding: "0 10px" }}>
      {loading && <Loader />}

      {meta && (
        <div
          className="media-hero-section"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(10, 10, 10, 0.95) 30%, rgba(10, 10, 10, 0.4) 100%), url(${meta.background || ""})`,
          }}
        >
          <div className="media-hero-content">
            <div className="media-hero-poster">
              {meta.poster && !imageError ? (
                <img
                  src={meta.poster}
                  alt={meta.name}
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="poster-placeholder-large">
                  <Film size={48} />
                </div>
              )}
            </div>
            <div className="media-hero-info">
              <h1>{meta.name}</h1>
              <div className="media-meta-badges">
                {meta.year && <span className="meta-badge">{meta.year}</span>}
                {meta.imdbRating && (
                  <span className="meta-badge rating">
                    <Star size={12} fill="currentColor" /> {meta.imdbRating}
                  </span>
                )}
                {meta.genres &&
                  meta.genres.map((g) => (
                    <span key={g} className="meta-badge genre">
                      {g}
                    </span>
                  ))}
              </div>
              {meta.description && (
                <p className="media-description">{meta.description}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SELECTED EPISODE STREAMING LIST */}
      {isEpisodePath && results.length > 0 && (
        <div className="selected-episode-streams">
          <h3>
            <Cable size={16} className="inline -mt-1 mr-1" /> Available Streams for Season {seasonParam} Episode {episodeParam}
          </h3>
          <div className="results-container">
            {results.map((item, index) => (
              <ResultCard
                key={`${item.infoHash || item.magnet || "no-hash"}-${item.title || "no-title"}-${index}`}
                item={item}
                index={index}
              />
            ))}
          </div>
        </div>
      )}

      {seasons.length > 0 && (
        <div className="series-view-container">
          {/* SEASON BAR */}
          <div className="season-bar-container">
            {canScrollLeft && (
              <>
                <div className="fade-left"></div>
                <button
                  className="scroll-arrow left"
                  tabIndex="-1"
                  onClick={() => scrollSeasons("left")}
                >
                  <ChevronLeft size={20} />
                </button>
              </>
            )}

            <div className="season-bar" ref={seasonBarRef} onScroll={checkScroll}>
              {seasons.map((s) => {
                const isActive = Number(selectedSeason) === Number(s);
                return (
                  <div
                    key={s}
                    className={`season-tab ${isActive ? "active" : ""}`}
                    onMouseEnter={() => {
                      setSelectedSeason(s);
                      setResults([]);
                    }}
                    onClick={() => {
                      setSelectedSeason(s);
                      setResults([]);
                    }}
                    tabIndex="0"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setSelectedSeason(s);
                        setResults([]);
                      }
                    }}
                  >
                    {isActive && (
                      <motion.div
                        className="season-tab-bg"
                        layoutId="active-season-pill"
                        transition={{ type: "spring", duration: 0.4, bounce: 0.2 }}
                      />
                    )}
                    <span className="season-tab-label">
                      {Number(s) === 0 ? "Specials" : `Season ${s}`}
                    </span>
                  </div>
                );
              })}
            </div>

            {canScrollRight && (
              <>
                <div className="fade-right"></div>
                <button
                  className="scroll-arrow right"
                  tabIndex="-1"
                  onClick={() => scrollSeasons("right")}
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>

          {/* EPISODES GRID */}
          {selectedSeason !== null && selectedSeason !== undefined && (
            <div
              className="episodes-grid"
              key={selectedSeason}
              style={{ marginTop: "20px", width: "100%" }}
            >
              {visibleEpisodes.map((episode, i) => (
                <div key={episode.id || `${episode.season}-${episode.episode}-${i}`}>
                  <EpisodeCard
                    episode={episode}
                    seriesId={id}
                    selectedItem={meta || selectedItem}
                    rating={episodeRatings[`${Number(episode.season)}:${Number(episode.episode)}`]}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {imdbMode && !isEpisodePath && results.length > 0 && (
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
    </div>
  );
}
