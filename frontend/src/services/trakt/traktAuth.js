import { traktApi } from "./traktApi.js";
import { API_URL } from "../api.js";

const STORAGE_KEYS = {
  ACCESS_TOKEN: "trakt_access_token",
  REFRESH_TOKEN: "trakt_refresh_token",
  EXPIRES_AT: "trakt_token_expires_at",
  USER: "trakt_user",
};

export const traktAuth = {
  async startDeviceFlow() {
    const response = await fetch(`${API_URL}/trakt/device/code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error("Failed to start Trakt device flow");
    }

    return response.json();
  },

  async pollForAccessToken(deviceCode, interval = 5) {
    return new Promise((resolve, reject) => {
      const maxDuration = 10 * 60 * 1000;
      const startTime = Date.now();

      const poller = setInterval(async () => {
        try {
          if (Date.now() - startTime >= maxDuration) {
            clearInterval(poller);
            reject(new Error("Trakt authentication timed out"));
            return;
          }

          const response = await fetch(`${API_URL}/trakt/device/token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: deviceCode,
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
            return;
          }

          if (response.status === 202) {
            return;
          }

          let errorData = {};

          try {
            errorData = await response.json();
          } catch {
            // Ignore malformed error responses
          }

          const message =
            errorData.message ||
            errorData.error_description ||
            "Failed to complete Trakt device flow";

          clearInterval(poller);
          reject(new Error(message));
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

    const response = await fetch(`${API_URL}/trakt/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refreshToken,
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
