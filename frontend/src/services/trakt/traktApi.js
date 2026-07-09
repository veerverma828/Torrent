import { API_URL } from "../api.js";

export const traktApi = {
  async request(endpoint, options = {}, _isRetry = false) {
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

    // A 401 mid-session (token expired between ensureValidToken's check and
    // this request landing, or a stale cached token) gets exactly one
    // refresh-and-retry before we give up and force reconnect.
    if (response.status === 401 && !_isRetry) {
      console.warn(`[TraktAPI] 401 on ${endpoint}, refreshing token and retrying once`);
      try {
        await traktAuth.refreshAccessToken();
      } catch {
        traktAuth.logout();
        throw new Error("Your Trakt session expired. Please reconnect your account.");
      }
      return this.request(endpoint, options, true);
    }

    if (!response.ok) {
      console.error(`[TraktAPI] Error ${response.status} on ${endpoint}`);
      if (response.status === 410) {
        throw new Error("Your Trakt account has been deactivated. Please log in on trakt.tv to reactivate it.");
      }
      if (response.status === 401) {
        traktAuth.logout();
        throw new Error("Your Trakt session expired. Please reconnect your account.");
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
