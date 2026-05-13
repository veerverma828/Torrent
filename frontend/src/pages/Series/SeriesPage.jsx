import { useEffect, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useAppContext } from "../../context/AppContext.jsx";
import { useSettingsContext } from "../../context/SettingsContext.jsx";
import { useStreamActions } from "../../hooks/useStreamActions.js";
import { useSeasonScroll } from "../../hooks/useSeasonScroll.js";
import { fetchSeriesMeta, fetchEpisodeStreams } from "../../services/cinemeta.js";
import Loader from "../../components/common/Loader.jsx";
import ResultCard from "../../components/cards/ResultCard.jsx";
import EpisodeCard from "../../components/cards/EpisodeCard.jsx";
import "./SeriesPage.css";

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
    loading,
    setLoading,
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

  // Use ref to avoid stale closure for initAction in effect
  const initActionRef = useRef(initAction);
  initActionRef.current = initAction;

  // Trigger checkScroll when seasons or selectedSeason change
  useEffect(() => {
    const timeout = setTimeout(checkScroll, 100);
    return () => clearTimeout(timeout);
  }, [seasons, selectedSeason, checkScroll]);

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

    // Fetch series metadata if not already loaded
    if (episodes.length === 0) {
      if (!isEpisodePath) setLoading(true);

      fetchSeriesMeta(id)
        .then((meta) => {
          if (meta) {
            const videos = meta.videos || [];

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

            if (extractedSeasons.length > 0 && !isEpisodePath) {
              const hasSeason1 = extractedSeasons.some((s) => Number(s) === 1);
              setSelectedSeason(hasSeason1 ? 1 : extractedSeasons[0]);
            }
          }

          if (!isEpisodePath) setLoading(false);
        })
        .catch((e) => {
          console.error(e);
          if (!isEpisodePath) setLoading(false);
        });
    }

    // If on episode path, fetch streams
    if (isEpisodePath) {
      setLoading(true);
      fetchEpisodeStreams(id, seasonParam, episodeParam, addonApis)
        .then((streams) => {
          setResults(streams);
          setLoading(false);
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

  return (
    <>
      {selectedItem && seasons.length > 0 && (
        <div className="series-view-container">
          <div className="center-margin-top">
            <h2 style={{ marginBottom: "20px" }}>{selectedItem.name}</h2>
          </div>

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
                  &#10094;
                </button>
              </>
            )}

            <div className="season-bar" ref={seasonBarRef} onScroll={checkScroll}>
              {seasons.map((s) => (
                <div
                  key={s}
                  className={`season-tab ${Number(selectedSeason) === Number(s) ? "active" : ""}`}
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
                  {Number(s) === 0 ? "Specials" : `Season ${s}`}
                </div>
              ))}
            </div>

            {canScrollRight && (
              <>
                <div className="fade-right"></div>
                <button
                  className="scroll-arrow right"
                  tabIndex="-1"
                  onClick={() => scrollSeasons("right")}
                >
                  &#10095;
                </button>
              </>
            )}
          </div>

          {/* EPISODES GRID */}
          {selectedSeason !== null && selectedSeason !== undefined && (
            <div
              className="fade-in-episodes"
              key={selectedSeason}
              style={{ marginTop: "20px", width: "100%" }}
            >
              <div className="episodes-grid">
                {episodes
                  .filter((ep) => Number(ep.season) === Number(selectedSeason))
                  .map((episode, i) => (
                    <EpisodeCard
                      key={i}
                      episode={episode}
                      seriesId={selectedItem.id}
                      selectedItem={selectedItem}
                    />
                  ))}
              </div>
            </div>
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
