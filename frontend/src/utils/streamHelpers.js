import { showToast } from "../components/common/Toast.jsx";

export function formatTorrentio(data) {
  const streams = data.streams || [];
  return streams
    .filter((item) => item.infoHash || item.url)
    .map((item) => ({
      title: item.title || item.name || "Unknown Stream",
      size: item.behaviorHints?.videoSize || 0,
      seeders: 0,
      // `magnet` doubles as "playable source": a real magnet for infoHash
      // streams, a direct URL for debrid-ready addons. `isDirect` is the
      // discriminator so consumers don't have to sniff the string.
      magnet: item.infoHash ? `magnet:?xt=urn:btih:${item.infoHash}` : item.url,
      isDirect: !item.infoHash && !!item.url,
      fileIdx: typeof item.fileIdx === "number" ? item.fileIdx : null,
      filename: item.behaviorHints?.filename || null,
      infoHash: item.infoHash || null,
      provider: item.name || "Addon",
    }));
}

export function copyMagnet(magnet) {
  navigator.clipboard.writeText(magnet);
  showToast("Magnet link copied", "success");
}
