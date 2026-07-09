import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { getEpisodeProgress } from "../../trackers/progressTracker.js";
import { useSettingsContext } from "../../context/SettingsContext.jsx";

function EpisodeCard({ episode, seriesId, selectedItem }) {
  const navigate = useNavigate();
  const { syncMode } = useSettingsContext();
  const isUnreleased = episode.released
    ? new Date(episode.released) > new Date()
    : false;
  const progress = getEpisodeProgress(seriesId, episode.season, episode.episode);

  // Determine progress bar color based on sync mode
  const getProgressColor = (percentage) => {
    if (percentage > 90) return "#1db954"; // Green for completed
    return syncMode === "trakt" ? "#e50914" : "#007BFF"; // Red for Trakt, Blue for local
  };

  return (
    <div
      className="episode-card"
      tabIndex="0"
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.click();
      }}
      onClick={() => {
        navigate(
          `/series/${selectedItem.id}/season/${episode.season}/episode/${episode.episode}`,
          { state: { item: selectedItem } }
        );
      }}
    >
      <motion.div className="episode-thumbnail" whileHover={{ scale: 1.03 }} transition={{ duration: 0.2 }}>
        <img
          src={episode.thumbnail || selectedItem.poster}
          alt={episode.name || episode.title || `Episode ${episode.episode}`}
          loading="lazy"
          decoding="async"
          draggable="false"
        />
        <div className="episode-number">Ep {episode.episode}</div>
        <div className="episode-play-icon">
          <Play size={20} fill="currentColor" />
        </div>
        {progress && progress.progress > 0 && (
          <div className="progress-bar-container">
            <div
              className="progress-bar"
              style={{
                width: `${Math.max(progress.percentage || 0, 3)}%`,
                backgroundColor: getProgressColor(progress.percentage || 0),
              }}
            ></div>
          </div>
        )}
      </motion.div>

      <div className="episode-info">
        <h4>
          <span
            className="episode-title-text"
            title={episode.name || episode.title || `Episode ${episode.episode}`}
          >
            {episode.name || episode.title || `Episode ${episode.episode}`}
          </span>
          {isUnreleased && <span className="unreleased-badge">Unreleased</span>}
        </h4>
        {episode.released && (
          <span className="episode-airdate">
            {isUnreleased ? "Airs: " : "Aired: "}{" "}
            {new Date(episode.released).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
        {progress && progress.progress > 0 && (
          <span
            style={{
              fontSize: "11px",
              color: getProgressColor(progress.percentage || 0),
              display: "block",
              marginBottom: "6px",
              fontWeight: "bold",
            }}
          >
            {progress.percentage > 90
              ? "Watched"
              : progress.percentage > 0
                ? `Watched: ${Math.round(progress.percentage)}%`
                : "Started"}
          </span>
        )}
        {episode.overview && (
          <p className="episode-overview">{episode.overview}</p>
        )}
      </div>
    </div>
  );
}

export default memo(EpisodeCard);
