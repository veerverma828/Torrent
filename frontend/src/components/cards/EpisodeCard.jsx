import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { getEpisodeProgress } from "../../trackers/progressTracker.js";

function EpisodeCard({ episode, seriesId, selectedItem }) {
  const navigate = useNavigate();
  const isUnreleased = episode.released
    ? new Date(episode.released) > new Date()
    : false;
  const progress = getEpisodeProgress(seriesId, episode.season, episode.episode);

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
      <div className="episode-thumbnail">
        <img
          src={episode.thumbnail || selectedItem.poster}
          alt={episode.name || episode.title || `Episode ${episode.episode}`}
          loading="lazy"
          decoding="async"
          draggable="false"
        />
        <div className="episode-number">Ep {episode.episode}</div>
        <div className="episode-play-icon">▶</div>
        {progress && progress.progress > 0 && (
          <div className="progress-bar-container">
            <div
              className="progress-bar"
              style={{
                width: `${Math.max(progress.percentage || 0, 3)}%`,
                backgroundColor: progress.percentage > 90 ? "#28a745" : "#007BFF",
              }}
            ></div>
          </div>
        )}
      </div>

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
              color: progress.percentage > 90 ? "#28a745" : "#007BFF",
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
