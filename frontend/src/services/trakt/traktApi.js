const TRAKT_API = "https://api.trakt.tv";

export const traktApi = {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem("trakt_access_token");

    const headers = {
      "Content-Type": "application/json",
      "trakt-api-version": "2",
      "trakt-api-key": import.meta.env.VITE_TRAKT_CLIENT_ID,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };

    const response = await fetch(`${TRAKT_API}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`Trakt API Error: ${response.status}`);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  },

  async getDeviceCode() {
    return this.request("/oauth/device/code", {
      method: "POST",
      body: JSON.stringify({
        client_id: import.meta.env.VITE_TRAKT_CLIENT_ID,
      }),
    });
  },

  async getProfile() {
    return this.request("/users/settings");
  },
};
