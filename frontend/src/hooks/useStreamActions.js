import { useNavigate, useLocation } from "react-router-dom";
import { useAppContext } from "../context/AppContext.jsx";
import { useSettingsContext } from "../context/SettingsContext.jsx";
import { usePlayerContext } from "../context/PlayerContext.jsx";
import { getFiles, generateLink } from "../services/torrentService.js";
import { openExternalPlayer, openDirectDownload } from "../services/streamService.js";
import { copyMagnet as copyMagnetUtil } from "../utils/streamHelpers.js";
import { showToast } from "../components/common/Toast.jsx";

export function useStreamActions() {
  const navigate = useNavigate();
  const location = useLocation();

  const { setResults } = useAppContext();
  const { debridService, realDebridApiKey, torboxApiKey, setIsSettingsOpen, setSettingsTab } =
    useSettingsContext();
  const debridKey = debridService === "real-debrid" ? realDebridApiKey : torboxApiKey;

  function requireDebridKey() {
    if (debridKey) return true;
    showToast("Add your debrid API key in Settings to stream");
    setSettingsTab("debrid");
    setIsSettingsOpen(true);
    return false;
  }
  const {
    setStreamUrl,
    setFileModalData,
    setProcessingMagnet,
    setProcessingFile,
    currentMagnet,
    fileModalData,
  } = usePlayerContext();

  // NOTE: intentionally NOT using useCallback so closures are always fresh.
  // These are event handlers — re-creation per render is harmless.

  async function selectFileAndExecute(fileId, overrideTorrentId, overrideActionType) {
    setProcessingFile(fileId);
    try {
      const torrentId = overrideTorrentId || (fileModalData ? fileModalData.torrentId : null);
      const action = overrideActionType || (fileModalData ? fileModalData.actionType : null);

      const data = await generateLink(torrentId, fileId, debridService, debridKey);

      if (data.downloadUrl) {
        if (fileModalData) setFileModalData(null);

        if (action === "download") {
          if (fileModalData) navigate(-1);
          window.open(data.downloadUrl);
        } else if (action === "stream") {
          navigate(`${location.pathname}?modal=stream`, {
            state: location.state,
            replace: !!fileModalData,
          });
          setStreamUrl(data.downloadUrl);
        } else if (action === "external") {
          if (fileModalData) navigate(-1);
          openExternalPlayer(data.downloadUrl);
        }
      } else {
        showToast(data.message || "Failed to generate link — torrent may not be fully cached yet.");
      }
    } catch (err) {
      showToast("Error generating link. Please try again.");
      console.error(err);
    }
    setProcessingFile(null);
  }

  async function initAction(magnetOrUrl, actionType, autoPlayFirst = false) {
    if (actionType === "stream") {
      currentMagnet.current = magnetOrUrl;
    }

    // SMART ROUTING: Handle Direct HTTP links instantly
    if (magnetOrUrl && magnetOrUrl.startsWith("http")) {
      if (actionType === "download") {
        openDirectDownload(magnetOrUrl);
      } else if (actionType === "stream") {
        navigate(`${location.pathname}?modal=stream`, { state: location.state });
        setStreamUrl(magnetOrUrl);
      } else if (actionType === "external") {
        openExternalPlayer(magnetOrUrl);
      }
      return;
    }

    if (!requireDebridKey()) return;

    setProcessingMagnet(magnetOrUrl);
    try {
      const data = await getFiles(magnetOrUrl, debridService, debridKey);

      if (data.files && data.files.length > 0) {
        if (autoPlayFirst) {
          await selectFileAndExecute(data.files[0].id, data.torrentId, actionType);
        } else {
          navigate(`${location.pathname}?modal=file`, { state: location.state });
          setFileModalData({
            magnet: magnetOrUrl,
            torrentId: data.torrentId,
            files: data.files,
            actionType,
          });
        }
      } else {
        showToast(data.message || "No files found — the torrent may still be caching.");
      }
    } catch (err) {
      showToast("Couldn't reach the server. It may be waking up — try again in ~30s.");
      console.error(err);
    }
    setProcessingMagnet(null);
  }

  function copyMagnet(magnet) {
    copyMagnetUtil(magnet);
  }

  return {
    initAction,
    selectFileAndExecute,
    copyMagnet,
  };
}
