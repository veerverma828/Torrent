import { API_URL } from "../api.js";

export const traktApi = {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem("trakt_access_token");

    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };

    const response = await fetch(`${API_URL}/trakt/proxy${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      if (response.status === 410) {
        throw new Error("Your Trakt account has been deactivated. Please log in on trakt.tv to reactivate it.");
      }
      throw new Error(`Trakt API Error: ${response.status}`);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  },

  async getProfile() {
    return this.request("/users/settings");
  },
};
