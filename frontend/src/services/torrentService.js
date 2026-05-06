import { API_URL, getApiHeaders } from "./api.js";

export async function getFiles(magnet, service, rdAdminCode) {
  const res = await fetch(`${API_URL}/get-files`, {
    method: "POST",
    headers: getApiHeaders(rdAdminCode),
    body: JSON.stringify({ magnet, service }),
  });
  const data = await res.json();
  if (data.files) {
    data.files.sort((a, b) => b.size - a.size);
  }
  return data;
}

export async function generateLink(torrentId, fileId, service, rdAdminCode) {
  const res = await fetch(`${API_URL}/generate-link`, {
    method: "POST",
    headers: getApiHeaders(rdAdminCode),
    body: JSON.stringify({ torrentId, fileId, service }),
  });
  return res.json();
}
