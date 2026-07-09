import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation, matchPath } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useMediaContext } from "../../context/AppContext.jsx";
import { usePlayerContext } from "../../context/PlayerContext.jsx";
import { progressService } from "../../trackers/progressService.js";
import { RESUME_SKIP_THRESHOLD } from "../../utils/constants.js";
import { API_URL } from "../../services/api.js";
import PlaybackEventHandler from "./PlaybackEventHandler.js";
import "../../pages/Player/PlayerPage.css";

export default function VideoPlayer() {
  const navigate = useNavigate();
  const location = useLocation();
  const hasLoggedStreamError = useRef(false);
  const timeoutRef = useRef(null);
  const playbackEventHandlerRef = useRef(null);
  const [playerErrorState, setPlayerErrorState] = useState({
    streamUrl: null,
    error: null,
  });

  const { selectedItem, episodes = [], seasons = [] } = useMediaContext();
  const { streamUrl, videoRef, currentMagnet } = usePlayerContext();

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

  const playerError =
    playerErrorState.streamUrl === streamUrl ? playerErrorState.error : null;

  const setCurrentPlayerError = (error) => {
    setPlayerErrorState({ streamUrl, error });
  };

  useEffect(() => {
    hasLoggedStreamError.current = false;

    if (!streamUrl) return undefined;

    timeoutRef.current = setTimeout(() => {
      setPlayerErrorState({
        streamUrl,
        error: {
          title: "Stream failed to start",
          message: "The provider may be slow or this format may not be supported in your browser.",
        },
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

  const handleLoadedMetadata = async (e) => {
    clearTimeout(timeoutRef.current);
    setCurrentPlayerError(null);

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
      if (resumeTime > 0 && savedProgress.percentage < RESUME_SKIP_THRESHOLD) {
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
          // Force a final flush with the true position before stopping —
          // the periodic onProgress tick is throttled to ~5s and can be
          // stale by the time playback actually pauses.
          if (videoRef.current) {
            progressService.saveProgress(metadata, videoRef.current.currentTime, videoRef.current.duration);
          }
          progressService.stopPlayback(metadata, percentage);
        },
        onEnded: (metadata) => {
          // Force the local record to exactly 100% rather than trusting
          // whatever the last throttled tick happened to land on.
          if (videoRef.current) {
            progressService.saveProgress(metadata, videoRef.current.duration, videoRef.current.duration);
          }
          progressService.stopPlayback(metadata, 100);
        },
        onProgress: (metadata, currentTime, duration) => {
          progressService.saveProgress(metadata, currentTime, duration);
        },
        onSeek: () => {
          // Handle seek events if needed
        },
        onError: (metadata, error) => {
          console.error('Playback error:', error);
        },
        onBeforeUnload: (metadata, currentTime, duration) => {
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

  const handleClose = () => {
    const metadata = getMetadata();
    if (metadata && videoRef.current) {
      const percentage = videoRef.current.duration > 0
        ? (videoRef.current.currentTime / videoRef.current.duration) * 100
        : 0;
      // Force a final flush of the true close-time position — otherwise up
      // to ~5s of progress since the last throttled tick is lost.
      progressService.saveProgress(metadata, videoRef.current.currentTime, videoRef.current.duration);
      progressService.stopPlayback(metadata, percentage);
    }
    
    // Cleanup playback event handler
    if (playbackEventHandlerRef.current) {
      playbackEventHandlerRef.current.destroy();
      playbackEventHandlerRef.current = null;
    }
    
    navigate(-1);
  };

  const handleRetry = () => {
    setCurrentPlayerError(null);

    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  };

  const handleError = (e) => {
    if (!hasLoggedStreamError.current) {
      hasLoggedStreamError.current = true;
      const mediaError = e.target.error;
      const errorMessage = mediaError?.message || mediaError || "Unknown error";
      
      // Handle privacy fingerprinting errors specifically
      if (errorMessage.includes("Failed to decode media") || errorMessage.includes("privacy.resistFingerprinting")) {
        console.warn("Media decode blocked by privacy settings:", errorMessage);
        setCurrentPlayerError({
          title: "Playback blocked by browser privacy settings",
          message: "Disable 'Resist Fingerprinting' in browser privacy settings to play this video."
        });
      } else {
        console.error("Video error:", e.target.error);
        setCurrentPlayerError({
          title: "Playback failed", 
          message: "This video format might not be supported in your browser."
        });
      }
    }
    hasLoggedStreamError.current = true;

    const mediaError = e.target.error;
    const errorMessage = mediaError?.message || "Unknown";

    fetch(`${API_URL}/log-stream-error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: streamUrl,
        rawMessage: errorMessage,
        code: mediaError?.code || "Unknown",
        networkState: e.target.networkState,
        readyState: e.target.readyState,
      }),
    }).catch((err) => console.error("Failed to send stream error log", err));
  };

  return (
    <AnimatePresence>
      {streamUrl && (
        <motion.div
          className="video-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button onClick={handleClose} className="video-close-btn inline-flex items-center gap-1.5">
            <X size={16} /> Close
          </button>

          <video
            ref={videoRef}
            src={streamUrl}
            controls
            playsInline
            className="video-player"
            onLoadedMetadata={handleLoadedMetadata}
            onError={handleError}
          />

          {playerError && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-bg-base/90 backdrop-blur-sm p-6 text-white">
              <div className="max-w-md rounded-2xl bg-bg-surface p-6 text-center">
                <h2 className="mb-3 text-xl font-semibold">{playerError.title}</h2>
                <p className="mb-5 text-sm text-neutral-300">{playerError.message}</p>

                <div className="flex justify-center gap-3">
                  <button onClick={handleRetry} className="rounded-lg bg-white px-4 py-2 font-medium text-black">
                    Retry Playback
                  </button>

                  <button onClick={handleClose} className="rounded-lg border border-white/20 px-4 py-2 font-medium text-white inline-flex items-center gap-1.5">
                    <X size={14} /> Close Player
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
