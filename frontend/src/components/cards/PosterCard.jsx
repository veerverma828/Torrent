import { useNavigate } from "react-router-dom";
import { getMovieProgress } from "../../trackers/progressTracker.js";

export default function PosterCard({ item, type = "movie" }) {
  const navigate = useNavigate();
  const progress = type === "movie" ? getMovieProgress(item.id) : null;

  return (
    <div
      className="poster-card"
      tabIndex="0"
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.click();
      }}
      onClick={() => {
        if (type === "movie") {
          navigate(`/movie/${item.id}`, { state: { item } });
        } else {
          navigate(`/series/${item.id}`, { state: { item } });
        }
      }}
    >
      <div className="poster-img-container">
        <img src={item.poster} alt={item.name} />
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
      <p>{item.name}</p>
      <small>{item.type}</small>
    </div>
  );
}
