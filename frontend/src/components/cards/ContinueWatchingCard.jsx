import { memo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Film } from "lucide-react";
import { fetchMeta } from "../../services/cinemeta.js";
import { updateTrackingMetadata } from "../../trackers/progressTracker.js";
import { useSettingsContext } from "../../context/SettingsContext.jsx";

function ContinueWatchingCard({ item, onRemove }) {
  const navigate = useNavigate();
  const { syncMode } = useSettingsContext();
  const [meta, setMeta] = useState({
    title: item.type === "movie" ? item.title : item.seriesTitle,
    poster: item.type === "movie" ? item.poster : item.seriesPoster,
  });
  const [imageError, setImageError] = useState(false);
  const hasHydrated = useRef(false);

  // Determine progress bar color based on sync mode (not item.source)
  const getProgressColor = () => {
    if (item.percentage > 90) return "#1db954"; // Green for completed
    return syncMode === "trakt" ? "#e50914" : "#007BFF"; // Red for Trakt, Blue for local
  };

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
          type="button"
          className="remove-cw-btn"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(item);
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            e.preventDefault();
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
        {(meta.poster && !imageError) ? (
          <img
            src={meta.poster}
            alt={meta.title}
            onError={() => setImageError(true)}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="poster-placeholder">
            <Film size={32} className="text-text-muted" />
            <div className="poster-placeholder-text">{meta.title || "Loading..."}</div>
          </div>
        )}
        {item.isNext && (
          <div className="next-ep-badge">Next Episode ▶</div>
        )}
        {!item.isNext && (
          <div className="progress-bar-container">
            <div
              className="progress-bar"
              style={{
                width: `${Math.max(item.percentage || 0, 3)}%`,
                backgroundColor: getProgressColor(),
              }}
            ></div>
          </div>
        )}
      </div>
      <p>{meta.title || "Loading..."}</p>
      <small>
        {item.type === "movie" ? "Movie" : `S${item.season} E${item.episode}`}
      </small>
    </div>
  );
}

export default memo(ContinueWatchingCard);
