import { traktApi } from "./traktApi.js";

const STORAGE_KEYS = {
  ACCESS_TOKEN: "trakt_access_token",
  REFRESH_TOKEN: "trakt_refresh_token",
  EXPIRES_AT: "trakt_token_expires_at",
  USER: "trakt_user",
};

export const traktAuth = {
  async startDeviceFlow() {
    return traktApi.getDeviceCode();
  },

  async pollForAccessToken(deviceCode, interval = 5) {
    return new Promise((resolve, reject) => {
      const poller = setInterval(async () => {
        try {
          const response = await fetch("https://api.trakt.tv/oauth/device/token", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "trakt-api-version": "2",
              "trakt-api-key": import.meta.env.VITE_TRAKT_CLIENT_ID,
            },
            body: JSON.stringify({
              code: deviceCode,
              client_id: import.meta.env.VITE_TRAKT_CLIENT_ID,
              client_secret: import.meta.env.VITE_TRAKT_CLIENT_SECRET,
            }),
          });

          if (response.status === 200) {
            clearInterval(poller);

            const data = await response.json();

            this.saveTokens(data);

            try {
              const profile = await traktApi.getProfile();
              localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(profile.user));
            } catch {
              // Ignore profile fetch failures
            }

            resolve(data);
          }
        } catch (error) {
          clearInterval(poller);
          reject(error);
        }
      }, interval * 1000);
    });
  },

  saveTokens(data) {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.access_token);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
    localStorage.setItem(
      STORAGE_KEYS.EXPIRES_AT,
      String(Date.now() + data.expires_in * 1000)
    );
  },

  async refreshAccessToken() {
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

    if (!refreshToken) {
      throw new Error("Missing refresh token");
    }

    const response = await fetch("https://api.trakt.tv/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refresh_token: refreshToken,
        client_id: import.meta.env.VITE_TRAKT_CLIENT_ID,
        client_secret: import.meta.env.VITE_TRAKT_CLIENT_SECRET,
        redirect_uri: "urn:ietf:wg:oauth:2.0:oob",
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      this.logout();
      throw new Error("Failed to refresh Trakt token");
    }

    const data = await response.json();

    this.saveTokens(data);

    return data;
  },

  async ensureValidToken() {
    const expiresAt = Number(localStorage.getItem(STORAGE_KEYS.EXPIRES_AT) || 0);

    if (!expiresAt) {
      return false;
    }

    const refreshWindow = 5 * 60 * 1000;

    if (Date.now() + refreshWindow >= expiresAt) {
      await this.refreshAccessToken();
    }

    return true;
  },

  logout() {
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });
  },

  isAuthenticated() {
    return Boolean(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN));
  },

  getUser() {
    const user = localStorage.getItem(STORAGE_KEYS.USER);
    return user ? JSON.parse(user) : null;
  },
};
