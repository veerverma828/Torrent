import { API_URL } from "../api.js";

export const traktApi = {
  async request(endpoint, options = {}) {
    const { traktAuth } = await import("./traktAuth.js");
    await traktAuth.ensureValidToken();

    const token = localStorage.getItem("trakt_access_token");

    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };

    const url = `${API_URL}/trakt/proxy${endpoint}`;
    console.log(`[TraktAPI] ${options.method || "GET"} ${endpoint}`);

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      console.error(`[TraktAPI] Error ${response.status} on ${endpoint}`);
      if (response.status === 410) {
        throw new Error("Your Trakt account has been deactivated. Please log in on trakt.tv to reactivate it.");
      }
      throw new Error(`Trakt API Error: ${response.status}`);
    }

    if (response.status === 204) {
      return null;
    }

    const data = await response.json();
    console.log(`[TraktAPI] Success ${endpoint}`, Array.isArray(data) ? `(${data.length} items)` : "");
    return data;
  },

  async getProfile() {
    return this.request("/users/settings");
  },
};
