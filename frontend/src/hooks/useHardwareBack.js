import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { useSettingsContext } from "../context/SettingsContext.jsx";
import { usePlayerContext } from "../context/PlayerContext.jsx";

/**
 * Makes the Android hardware/back gesture behave predictably instead of
 * jumping to the wrong screen or exiting the app outright. Priority:
 *   1. an open modal (settings / file picker / stream) closes first
 *   2. otherwise step back one route
 *   3. only at the home route does back minimise the app
 *
 * The native ExoPlayer runs in its own Activity and handles its own back, so
 * this only governs the WebView UI.
 */
export function useHardwareBack() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSettingsOpen, setIsSettingsOpen } = useSettingsContext();
  const { streamUrl, fileModalData } = usePlayerContext();

  // Keep a live snapshot so the single native listener never goes stale.
  const state = useRef({});
  state.current = { location, isSettingsOpen, streamUrl, fileModalData };

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let handle;
    let lastBack = 0;
    App.addListener("backButton", () => {
      // Debounce: some TV remotes deliver the event twice in quick
      // succession, which would pop two history entries at once.
      const now = Date.now();
      if (now - lastBack < 400) return;
      lastBack = now;

      const { location: loc, isSettingsOpen: settings, streamUrl: stream, fileModalData: files } = state.current;

      if (settings) {
        setIsSettingsOpen(false);
        return;
      }
      // Stream / file modals are query-driven; popping history closes them
      // via the route-modal sync in Layout.
      if (stream || files || new URLSearchParams(loc.search).get("modal")) {
        navigate(-1);
        return;
      }
      if (loc.pathname !== "/") {
        navigate(-1);
        return;
      }
      App.minimizeApp();
    }).then((l) => {
      handle = l;
    });

    return () => handle?.remove();
  }, [navigate, setIsSettingsOpen]);
}
