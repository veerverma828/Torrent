import { useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation, matchPath } from "react-router-dom";
import { useMediaContext } from "../../context/AppContext.jsx";
import { usePlayerContext } from "../../context/PlayerContext.jsx";
import {
  saveProgress,
  getMovieProgress,
  getEpisodeProgress,
} from "../../trackers/progressTracker.js";
import { API_URL } from "../../services/api.js";

export default function VideoPlayer() {
  const navigate = useNavigate();
  const location = useLocation();
  const hasLoggedStreamError = useRef(false);

  const { selectedItem, episodes, seasons } = useMediaContext();
  const { streamUrl, videoRef, currentMagnet, progressInterval } = usePlayerContext();

  const movieMatch = useMemo(
    () => matchPath("/movie/:id", location.pathname),
    [location.pathname]
  );

  const episodeMatch = useMemo(
    () =>
      matchPath(
        "/series/:id/season/:season/episode/:episode",
        location.pathname
      ),
    [location.pathname]
  );

  const episodeMetadata = useMemo(() => {
    if (!episodeMatch) {
      return null;
    }

    const seasonNum = Number(episodeMatch.params.season);
    const epNum = Number(episodeMatch.params.episode);

    const currentEp = episodes.find(
      (ep) => Number(ep.season) === seasonNum && Number(ep.episode) === epNum
    );

    return {
      seasonNum,
      episodesInSeason: episodes.filter((ep) => Number(ep.season) === seasonNum).length,
      currentEp,
    };
  }, [episodeMatch, episodes]);

  useEffect(() => {
    hasLoggedStreamError.current = false;
  }, [streamUrl]);

  if (!streamUrl) return null;

  const handleLoadedMetadata = (e) => {
    let savedProgress = null;

    if (movieMatch) {
      savedProgress = getMovieProgress(movieMatch.params.id);
    } else if (episodeMatch) {
      savedProgress = getEpisodeProgress(
        episodeMatch.params.id,
        episodeMatch.params.season,
        episodeMatch.params.episode
      );
    }

    if (savedProgress && savedProgress.progress > 0 && savedProgress.percentage < 95) {
      e.target.currentTime = savedProgress.progress;
    }
  };

  const handleTimeUpdate = (e) => {
    const currentTime = e.target.currentTime;
    const duration = e.target.duration;
    const now = Date.now();

    if (
      now - progressInterval.current.lastTick > 5000 ||
      Math.abs(currentTime - progressInterval.current.lastSaveTime) > 5
    ) {
      progressInterval.current = { lastSaveTime: currentTime, lastTick: now };

      let metadata = null;

      if (movieMatch) {
        metadata = {
          type: "movie",
          id: movieMatch.params.id,
          title: selectedItem?.name,
          poster: selectedItem?.poster,
          magnet: currentMagnet.current,
        };
      } else if (episodeMatch && episodeMetadata) {
        metadata = {
          type: "series",
          id: episodeMatch.params.id,
          season: episodeMatch.params.season,
          episode: episodeMatch.params.episode,
          episodesInSeason: episodeMetadata.episodesInSeason,
          totalSeasons: seasons.length,
          title: selectedItem?.name,
          poster: selectedItem?.poster,
          episodeTitle:
            episodeMetadata.currentEp?.name || episodeMetadata.currentEp?.title,
          thumbnail: episodeMetadata.currentEp?.thumbnail,
          magnet: currentMagnet.current,
        };
      }

      if (metadata) {
        saveProgress(metadata, currentTime, duration);
      }
    }
  };

  const handleError = (e) => {
    const error = e.target.error;
    const errorMsg =
      error?.message || "Unknown error (likely unsupported format like MKV or CORS issue)";

    alert(`❌ Error playing video: ${errorMsg}\n\nTry downloading it instead.`);

    if (hasLoggedStreamError.current) {
      return;
    }

    hasLoggedStreamError.current = true;

    fetch(`${API_URL}/log-stream-error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: streamUrl,
        rawMessage: error?.message || "",
        code: error?.code || "Unknown",
        networkState: e.target.networkState,
        readyState: e.target.readyState,
      }),
    }).catch((err) => console.log("Failed to send log to backend"));
  };

  return (
    <div className="video-modal">
      <button onClick={() => navigate(-1)} className="video-close-btn">
        ✖ Close
      </button>

      <video
        ref={videoRef}
        src={streamUrl}
        controls
        autoPlay
        playsInline
        className="video-player"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onError={handleError}
      />
    </div>
  );
}
