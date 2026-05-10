import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { fetchMeta } from "../../services/cinemeta.js";
import { updateTrackingMetadata } from "../../trackers/progressTracker.js";

export default function ContinueWatchingCard({ item, onRemove }) {
  const navigate = useNavigate();
  const [meta, setMeta] = useState({
    title: item.type === "movie" ? item.title : item.seriesTitle,
    poster: item.type === "movie" ? item.poster : item.seriesPoster,
  });
  const hasHydrated = useRef(false);

  useEffect(() => {
    if (
      !hasHydrated.current &&
      (!meta.poster || !meta.title || meta.title.includes("Unknown"))
    ) {
      const fetchMetaData = async () => {
        hasHydrated.current = true;
        try {
          const type = item.type === "movie" ? "movie" : "series";
          const id = item.type === "movie" ? item.id : item.seriesId;
          const data = await fetchMeta(type, id);
          if (data) {
            setMeta({ title: data.name, poster: data.poster });
            updateTrackingMetadata(type, id, data.name, data.poster);
          }
        } catch (e) {
          console.error("Failed to hydrate meta", e);
        }
      };
      fetchMetaData();
    }
  }, [item, meta]);

  const handleClick = () => {
    if (item.type === "movie") {
      navigate(`/movie/${item.id}`, {
        state: {
          item: { id: item.id, name: meta.title, poster: meta.poster, type: "movie" },
          autoPlayMagnet: item.magnet || null,
        },
      });
    } else {
      navigate(
        `/series/${item.seriesId}/season/${item.season}/episode/${item.episode}`,
        {
          state: {
            item: {
              id: item.seriesId,
              name: meta.title,
              poster: meta.poster,
              type: "series",
            },
            autoPlayMagnet: item.magnet || null,
          },
        }
      );
    }
  };

  return (
    <div
      className="poster-card"
      tabIndex="0"
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.click();
      }}
      onClick={handleClick}
    >
      <div className="poster-img-container">
        <button
          className="remove-cw-btn"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(item);
          }}
          title="Remove from Continue Watching"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        {meta.poster ? (
          <img src={meta.poster} alt={meta.title} />
        ) : (
          <div
            style={{
              width: "100%",
              aspectRatio: "2/3",
              backgroundColor: "#222",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span className="loader-small" style={{ margin: 0 }}></span>
          </div>
        )}
        <div className="progress-bar-container">
          <div
            className="progress-bar"
            style={{
              width: `${Math.max(item.percentage || 0, 3)}%`,
              backgroundColor: item.source === "trakt" ? "#ED1C24" : "#007BFF",
            }}
          ></div>
        </div>
      </div>
      <p>{meta.title || "Loading..."}</p>
      <small>
        {item.type === "movie" ? "Movie" : `S${item.season} E${item.episode}`}
      </small>
    </div>
  );
}
