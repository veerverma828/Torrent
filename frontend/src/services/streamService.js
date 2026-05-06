import { isAndroid, isIOS } from "../utils/deviceHelpers.js";

export function openExternalPlayer(url) {
  if (isAndroid()) {
    const urlObj = new URL(url);
    window.location.href = `intent://${urlObj.host}${urlObj.pathname}${urlObj.search}#Intent;scheme=${urlObj.protocol.replace(":", "")};type=video/*;action=android.intent.action.VIEW;end`;
  } else if (isIOS()) {
    window.location.href = `vlc://${url}`;
  } else {
    const m3uContent = `#EXTM3U\n#EXTINF:-1, Stream\n${url}`;
    const blob = new Blob([m3uContent], { type: "audio/x-mpegurl" });
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = "Play_Stream.m3u";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  }
}

export function openDirectDownload(url) {
  window.open(url);
}

export function createM3uDownload(url) {
  openExternalPlayer(url);
}
