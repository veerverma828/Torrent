import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation, matchPath } from "react-router-dom";
import { useMediaContext } from "../../context/AppContext.jsx";
import { usePlayerContext } from "../../context/PlayerContext.jsx";
import { progressService } from "../../trackers/progressService.js";
import { API_URL } from "../../services/api.js";
import PlaybackEventHandler from "./PlaybackEventHandler.js";
import { crossDeviceSync } from "../../services/sync/crossDeviceSync.js";

export default function VideoPlayer() {
  const navigate = useNavigate();
  const location = useLocation();
  const hasLoggedStreamError = useRef(false);
  const timeoutRef = useRef(null);
  const playbackEventHandlerRef = useRef(null);
  const [playerError, setPlayerError] = useState(null);

  const { selectedItem, episodes = [], seasons = [] } = useMediaContext();
  const { streamUrl, videoRef, currentMagnet, progressInterval } = usePlayerContext();

  const movieMatch = useMemo(() => matchPath("/movie/:id", location.pathname), [location.pathname]);

  const episodeMatch = useMemo(() => matchPath("/series/:id/season/:season/episode/:episode", location.pathname), [location.pathname]);

  const episodeMetadata = useMemo(() => {
    if (!episodeMatch) return null;

    const seasonNum = Number(episodeMatch.params.season);
    const epNum = Number(episodeMatch.params.episode);

    const currentEp = episodes.find((ep) => Number(ep.season) === seasonNum && Number(ep.episode) === epNum);

    return {
      seasonNum,
      episodesInSeason: episodes.filter((ep) => Number(ep.season) === seasonNum).length,
      currentEp,
    };
  }, [episodeMatch, episodes]);

  useEffect(() => {
    hasLoggedStreamError.current = false;
    setPlayerError(null);

    if (!streamUrl) return undefined;

    timeoutRef.current = setTimeout(() => {
      setPlayerError({
        title: "Stream failed to start",
        message: "The provider may be slow or this format may not be supported in your browser.",
      });
    }, 8000);

    return () => {
      clearTimeout(timeoutRef.current);
      // Cleanup playback event handler
      if (playbackEventHandlerRef.current) {
        playbackEventHandlerRef.current.destroy();
        playbackEventHandlerRef.current = null;
      }
    };
  }, [streamUrl]);

  if (!streamUrl) return null;

  const handleLoadedMetadata = async (e) => {
    clearTimeout(timeoutRef.current);
    setPlayerError(null);

    // Trigger play manually so we can catch and suppress abort rejections
    e.target.play().catch(() => {});

    let savedProgress = null;

    if (movieMatch) {
      savedProgress = await progressService.getMovieProgress(movieMatch.params.id);
    } else if (episodeMatch) {
      savedProgress = await progressService.getEpisodeProgress(
        episodeMatch.params.id,
        episodeMatch.params.season,
        episodeMatch.params.episode
      );
    }

    if (savedProgress) {
      let resumeTime = savedProgress.progress;
      if ((!resumeTime || resumeTime <= 0) && savedProgress.percentage > 0 && e.target.duration > 0) {
        resumeTime = (savedProgress.percentage / 100) * e.target.duration;
      }
      if (resumeTime > 0 && savedProgress.percentage < 95) {
        e.target.currentTime = resumeTime;
      }
    }

    // Initialize playback event handler
    const metadata = getMetadata();
    if (metadata && videoRef.current) {
      playbackEventHandlerRef.current = new PlaybackEventHandler(videoRef.current, metadata, {
        onPlay: (metadata, percentage) => {
          progressService.startPlayback(metadata, percentage);
        },
        onPause: (metadata, percentage) => {
          progressService.stopPlayback(metadata, percentage);
        },
        onEnded: (metadata, percentage, totalWatchTime) => {
          progressService.stopPlayback(metadata, percentage);
        },
        onProgress: (metadata, currentTime, duration, percentage) => {
          progressService.saveProgress(metadata, currentTime, duration);
        },
        onSeek: (metadata, newTime, oldTime) => {
          // Handle seek events if needed
        },
        onError: (metadata, error) => {
          console.error('Playback error:', error);
        },
        onBeforeUnload: (metadata, currentTime, duration, percentage) => {
          progressService.saveProgress(metadata, currentTime, duration);
        }
      });
    }
  };

  const getMetadata = () => {
    if (movieMatch) {
      return {
        type: "movie",
        id: movieMatch.params.id,
        imdbId: selectedItem?.id,
        title: selectedItem?.name,
        poster: selectedItem?.poster,
        magnet: currentMagnet.current,
      };
    }
    if (episodeMatch && episodeMetadata) {
      return {
        type: "series",
        id: episodeMatch.params.id,
        imdbId: selectedItem?.id,
        season: episodeMatch.params.season,
        episode: episodeMatch.params.episode,
        episodesInSeason: episodeMetadata.episodesInSeason,
        totalSeasons: seasons.length,
        title: selectedItem?.name,
        poster: selectedItem?.poster,
        episodeTitle: episodeMetadata.currentEp?.name || episodeMetadata.currentEp?.title,
        thumbnail: episodeMetadata.currentEp?.thumbnail,
        magnet: currentMagnet.current,
      };
    }
    return null;
  };

  const handlePlay = () => {
    // Play events are now handled by PlaybackEventHandler
  };

  const handleEnded = () => {
    // End events are now handled by PlaybackEventHandler
  };

  const handleClose = () => {
    const metadata = getMetadata();
    if (metadata && videoRef.current) {
      const percentage = videoRef.current.duration > 0 
        ? (videoRef.current.currentTime / videoRef.current.duration) * 100 
        : 0;
      progressService.stopPlayback(metadata, percentage);
    }
    
    // Cleanup playback event handler
    if (playbackEventHandlerRef.current) {
      playbackEventHandlerRef.current.destroy();
      playbackEventHandlerRef.current = null;
    }
    
    navigate(-1);
  };

  const handleTimeUpdate = (e) => {
    // Time update events are now handled by PlaybackEventHandler
  };

  const handleRetry = () => {
    setPlayerError(null);

    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  };

  const handleError = (e) => {
    if (!hasLoggedStreamError.current) {
      hasLoggedStreamError.current = true;
      const errorMessage = e.target.error?.message || e.target.error || "Unknown error";
      
      // Handle privacy fingerprinting errors specifically
      if (errorMessage.includes("Failed to decode media") || errorMessage.includes("privacy.resistFingerprinting")) {
        console.warn("Media decode blocked by privacy settings:", errorMessage);
        setPlayerError({
          title: "Playback blocked by browser privacy settings",
          message: "Disable 'Resist Fingerprinting' in browser privacy settings to play this video."
        });
      } else {
        console.error("Video error:", e.target.error);
        setPlayerError({
          title: "Playback failed", 
          message: "This video format might not be supported in your browser."
        });
      }
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
    }).catch((err) => console.error("Failed to send stream error log", err));
  };

  return (
    <div className="video-modal">
      <button onClick={handleClose} className="video-close-btn">
        ✖ Close
      </button>

      <video
        ref={videoRef}
        src={streamUrl}
        controls
        playsInline
        className="video-player"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onError={handleError}
        onPlay={handlePlay}
        onEnded={handleEnded}
      />

      {playerError && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-6 text-white">
          <div className="max-w-md rounded-2xl bg-neutral-900 p-6 text-center">
            <h2 className="mb-3 text-xl font-semibold">{playerError.title}</h2>
            <p className="mb-5 text-sm text-neutral-300">{playerError.message}</p>

            <div className="flex justify-center gap-3">
              <button onClick={handleRetry} className="rounded-lg bg-white px-4 py-2 font-medium text-black">
                Retry Playback
              </button>

              <button onClick={handleClose} className="rounded-lg border border-white/20 px-4 py-2 font-medium text-white">
                Close Player
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
