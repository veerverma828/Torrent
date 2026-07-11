import { API_URL } from "./api.js";

// Bring-your-own-key: apiKey is the user's own Real-Debrid or Torbox key
// (whichever matches `service`), forwarded per-request. Nothing works
// without one — there is no shared server-side key anymore.
const debridHeaders = (apiKey) => ({
  "Content-Type": "application/json",
  ...(apiKey ? { "x-debrid-key": apiKey } : {}),
});

export async function getFiles(magnet, service, apiKey) {
  const res = await fetch(`${API_URL}/get-files`, {
    method: "POST",
    headers: debridHeaders(apiKey),
    body: JSON.stringify({ magnet, service }),
  });
  const data = await res.json();
  if (data.files) {
    data.files.sort((a, b) => b.size - a.size);
  }
  return data;
}

export async function generateLink(torrentId, fileId, service, apiKey) {
  const res = await fetch(`${API_URL}/generate-link`, {
    method: "POST",
    headers: debridHeaders(apiKey),
    body: JSON.stringify({ torrentId, fileId, service }),
  });
  return res.json();
}

export async function verifyDebridKey(service, apiKey) {
  const res = await fetch(`${API_URL}/verify-debrid`, {
    method: "POST",
    headers: debridHeaders(apiKey),
    body: JSON.stringify({ service }),
  });
  return res.json().then((data) => ({ ok: res.ok && data.success, ...data }));
}
