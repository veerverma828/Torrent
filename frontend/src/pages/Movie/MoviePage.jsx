import { useEffect, useRef, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Star, Film, Cable } from "lucide-react";
import { useAppContext } from "../../context/AppContext.jsx";
import { useSettingsContext } from "../../context/SettingsContext.jsx";
import { useStreamActions } from "../../hooks/useStreamActions.js";
import { fetchMovieStreams, fetchMeta } from "../../services/cinemeta.js";
import Loader from "../../components/common/Loader.jsx";
import ResultCard from "../../components/cards/ResultCard.jsx";
import "./MoviePage.css";

export default function MoviePage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const { setSelectedItem, setResults, setLoading, loading, results } = useAppContext();
  const { addonApis } = useSettingsContext();
  const { initAction } = useStreamActions();

  const [meta, setMeta] = useState(null);
  const [imageError, setImageError] = useState(false);

  // Use ref to avoid stale closure for initAction in effect
  const initActionRef = useRef(initAction);
  initActionRef.current = initAction;

  // Fetch movie metadata
  useEffect(() => {
    fetchMeta("movie", id)
      .then((data) => {
        if (data) setMeta(data);
      })
      .catch((e) => {
        console.error("Failed to fetch movie metadata:", e);
      });
  }, [id]);

  useEffect(() => {
    const stateItem = location.state?.item;
    const autoPlayMagnet = location.state?.autoPlayMagnet;

    setSelectedItem(stateItem || { id, name: "Movie", type: "movie" });

    if (autoPlayMagnet) {
      navigate(location.pathname, {
        state: { ...location.state, autoPlayMagnet: null },
        replace: true,
      });
      initActionRef.current(autoPlayMagnet, "stream", true);
    }

    setLoading(true);
    fetchMovieStreams(id, addonApis)
      .then((streams) => {
        setResults(streams);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, addonApis, location.pathname]);

  return (
    <div className="movie-page-wrapper" style={{ padding: "0 10px" }}>
      {loading && <Loader />}

      {meta && (
        <div
          className="media-hero-section"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(10, 10, 10, 0.95) 30%, rgba(10, 10, 10, 0.4) 100%), url(${meta.background || ""})`,
          }}
        >
          <div className="media-hero-content">
            <motion.div
              className="media-hero-poster"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
            >
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
            </motion.div>
            <div className="media-hero-info">
              <h1>{meta.name}</h1>
              <div className="media-meta-badges">
                {meta.year && <span className="meta-badge">{meta.year}</span>}
                {meta.runtime && <span className="meta-badge">{meta.runtime}</span>}
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

      <div className="streams-section">
        <h3 className="streams-title">
          <Cable size={18} className="inline -mt-1 mr-1" /> Available Streams
        </h3>
        {results.length > 0 ? (
          <div className="results-container">
            {results.map((item, index) => (
              <ResultCard
                key={`${item.infoHash || item.magnet || "no-hash"}-${item.title || "no-title"}-${index}`}
                item={item}
                index={index}
              />
            ))}
          </div>
        ) : (
          !loading && (
            <div className="no-streams-msg">
              No streams found for this movie. Check your addon APIs or settings.
            </div>
          )
        )}
      </div>
    </div>
  );
}
