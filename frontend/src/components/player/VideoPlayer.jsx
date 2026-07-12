import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation, matchPath } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useMediaContext } from "../../context/AppContext.jsx";
import { useSettingsContext } from "../../context/SettingsContext.jsx";
import { usePlayerContext } from "../../context/PlayerContext.jsx";
import { progressService } from "../../trackers/progressService.js";
import { showToast } from "../common/Toast.jsx";
import { RESUME_SKIP_THRESHOLD } from "../../utils/constants.js";
import { API_URL } from "../../services/api.js";
import { fetchEpisodeStreams } from "../../services/cinemeta.js";
import { getFiles, generateLink } from "../../services/torrentService.js";
import {
  isNativePlayerAvailable,
  playNative,
  playTorrentNative,
  stopNative,
  onNativePlayerEvent,
} from "../../lib/nativePlayer.js";
import PlaybackEventHandler from "./PlaybackEventHandler.js";
import "../../pages/Player/PlayerPage.css";

// Next episode in play order, across season boundaries. Returns null at the
// end of the available list.
function findNextEpisode(episodes, season, episode) {
  const sorted = [...episodes]
    .filter((e) => e.season != null && e.episode != null)
    .sort((a, b) => Number(a.season) - Number(b.season) || Number(a.episode) - Number(b.episode));
  const idx = sorted.findIndex(
    (e) => Number(e.season) === Number(season) && Number(e.episode) === Number(episode)
  );
  return idx >= 0 && idx + 1 < sorted.length ? sorted[idx + 1] : null;
}

function seriesSubtitle(meta) {
  if (!meta || meta.type !== "series") return "";
  const base = `S${meta.season} E${meta.episode}`;
  return meta.episodeTitle ? `${base} · ${meta.episodeTitle}` : base;
}

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
  const { addonApis, debridService, realDebridApiKey, torboxApiKey } = useSettingsContext();
  const debridKey = debridService === "real-debrid" ? realDebridApiKey : torboxApiKey;
  const { streamUrl, setStreamUrl, videoRef, currentMagnet } = usePlayerContext();

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

    // Native path drives its own error/lifecycle handling below.
    if (!streamUrl || isNativePlayerAvailable) return undefined;

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

    // Progress is stored purely as a percentage — resuming always derives a
    // seconds offset from the currently-loaded video's actual duration,
    // which is also more accurate than trusting a stale stored duration if
    // this playback session is a different file/quality than last time.
    if (savedProgress?.percentage > 0 && savedProgress.percentage < RESUME_SKIP_THRESHOLD && e.target.duration > 0) {
      e.target.currentTime = (savedProgress.percentage / 100) * e.target.duration;
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

  // ===== Native (Android) playback: hand the URL to the ExoPlayer activity =====
  useEffect(() => {
    if (!isNativePlayerAvailable || !streamUrl) return undefined;

    let disposed = false;
    const unsubs = [];
    // A "magnet:" stream URL means P2P torrent streaming (no debrid); anything
    // else is an already-resolved direct/debrid HTTP URL.
    const isP2P = typeof streamUrl === "string" && streamUrl.startsWith("magnet:");
    const pct = (posMs, durMs) => (durMs > 0 ? (posMs / durMs) * 100 : 0);
    const saveFromEvent = (m, posMs, durMs) => {
      if (m && durMs > 0) progressService.saveProgress(m, posMs / 1000, durMs / 1000);
    };

    const resolveAndPlayNext = async () => {
      if (!episodeMatch) return stopNative();
      const seriesId = episodeMatch.params.id;
      const next = findNextEpisode(episodes, episodeMatch.params.season, episodeMatch.params.episode);
      if (!next) return stopNative();

      const streams = await fetchEpisodeStreams(seriesId, next.season, next.episode, addonApis);
      const magnet = streams?.[0]?.magnet;
      if (!magnet) return stopNative();

      currentMagnet.current = magnet;
      const nextMeta = {
        type: "series",
        id: seriesId,
        imdbId: selectedItem?.id,
        season: String(next.season),
        episode: String(next.episode),
        episodesInSeason: episodes.filter((e) => Number(e.season) === Number(next.season)).length,
        totalSeasons: seasons.length,
        title: selectedItem?.name,
        poster: selectedItem?.poster,
        episodeTitle: next.name || next.title,
        thumbnail: next.thumbnail,
        magnet,
      };
      const nextArgs = {
        title: nextMeta.title || "",
        subtitle: seriesSubtitle(nextMeta),
        startPercent: 0,
        metadata: nextMeta,
        hasNext: !!findNextEpisode(episodes, next.season, next.episode),
      };

      // Continue in the same mode the user started in.
      if (isP2P && !magnet.startsWith("http")) {
        await playTorrentNative({ magnet, ...nextArgs });
        return;
      }

      let url;
      if (magnet.startsWith("http")) {
        url = magnet;
      } else {
        const filesData = await getFiles(magnet, debridService, debridKey);
        const fileId = filesData?.files?.[0]?.id;
        if (!fileId) return stopNative();
        const link = await generateLink(filesData.torrentId, fileId, debridService, debridKey);
        url = link?.downloadUrl;
      }
      if (!url) return stopNative();

      await playNative({ url, ...nextArgs });
    };

    unsubs.push(onNativePlayerEvent("progress", ({ metadata, positionMs, durationMs }) => saveFromEvent(metadata, positionMs, durationMs)));
    unsubs.push(onNativePlayerEvent("resumed", ({ metadata, positionMs, durationMs }) => {
      if (metadata) progressService.startPlayback(metadata, pct(positionMs, durationMs));
    }));
    unsubs.push(onNativePlayerEvent("paused", ({ metadata, positionMs, durationMs }) => {
      saveFromEvent(metadata, positionMs, durationMs);
      if (metadata) progressService.stopPlayback(metadata, pct(positionMs, durationMs));
    }));
    unsubs.push(onNativePlayerEvent("ended", ({ metadata, durationMs }) => {
      if (metadata && durationMs > 0) progressService.saveProgress(metadata, durationMs / 1000, durationMs / 1000);
      if (metadata) progressService.stopPlayback(metadata, 100);
    }));
    unsubs.push(onNativePlayerEvent("playNext", () => {
      resolveAndPlayNext().catch((e) => {
        console.error("Auto-next failed:", e);
        stopNative();
      });
    }));
    unsubs.push(onNativePlayerEvent("closed", () => {
      if (disposed) return;
      disposed = true;
      setStreamUrl(null);
      navigate(-1);
    }));
    // P2P resolve progress is now shown inside PlayerActivity itself (native
    // loading overlay), not as a web toast — torrentStatus is no longer
    // consumed here.
    unsubs.push(onNativePlayerEvent("error", ({ message }) => {
      console.error("Native player error:", message);
      // If this fires before PlayerActivity ever opened (e.g. P2P metadata
      // resolution failed/timed out), the modal state must be cleared too —
      // otherwise the UI looks stuck on a stream that silently died.
      showToast(message || "Playback failed to start");
      if (!disposed) {
        disposed = true;
        setStreamUrl(null);
      }
    }));

    (async () => {
      const metadata = getMetadata();
      let prog = null;
      if (movieMatch) prog = await progressService.getMovieProgress(movieMatch.params.id);
      else if (episodeMatch)
        prog = await progressService.getEpisodeProgress(episodeMatch.params.id, episodeMatch.params.season, episodeMatch.params.episode);

      let startPercent = 0;
      if (prog?.percentage > 0 && prog.percentage < RESUME_SKIP_THRESHOLD) startPercent = prog.percentage;

      const hasNext = !!(episodeMatch && findNextEpisode(episodes, episodeMatch.params.season, episodeMatch.params.episode));

      const args = {
        title: metadata?.title || "",
        subtitle: seriesSubtitle(metadata),
        startPercent,
        metadata,
        hasNext,
      };
      if (isP2P) await playTorrentNative({ magnet: streamUrl, ...args });
      else await playNative({ url: streamUrl, ...args });
    })();

    return () => unsubs.forEach((u) => u && u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamUrl]);

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

  // Native player renders in its own full-screen Activity, so the web modal
  // stays empty on Android.
  if (isNativePlayerAvailable) return null;

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
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-bg-base/90 backdrop-blur-sm p-4 sm:p-6 text-white">
              <div className="w-full max-w-md rounded-2xl bg-bg-surface p-5 sm:p-6 text-center">
                <h2 className="mb-3 text-lg sm:text-xl font-semibold">{playerError.title}</h2>
                <p className="mb-5 text-sm text-neutral-300">{playerError.message}</p>

                <div className="flex flex-wrap justify-center gap-3">
                  <button onClick={handleRetry} className="rounded-lg bg-white px-4 py-2 font-medium text-black">
                    Retry Playback
                  </button>

                  <button onClick={handleClose} className="rounded-lg border border-white/20 px-4 py-2 font-medium text-white inline-flex items-center justify-center gap-1.5">
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
