export function formatTorrentio(data) {
  const streams = data.streams || [];
  return streams.map((item) => ({
    title: item.title || item.name || "Unknown Stream",
    size: 0,
    seeders: 0,
    magnet: item.infoHash ? `magnet:?xt=urn:btih:${item.infoHash}` : item.url,
    provider: item.name || "Addon",
  }));
}

export function copyMagnet(magnet) {
  navigator.clipboard.writeText(magnet);
  alert("Magnet link copied ✅");
}
