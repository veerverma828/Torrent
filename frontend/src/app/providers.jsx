import React from "react";
import { AppProvider } from "../context/AppContext.jsx";
import { SettingsProvider } from "../context/SettingsContext.jsx";
import { PlayerProvider } from "../context/PlayerContext.jsx";
import { UpdateProvider } from "../context/UpdateContext.jsx";
import { traktSyncQueue } from "../services/trakt/traktSyncQueue.js";
import { traktReconciliation } from "../services/trakt/traktReconciliation.js";
import { isTraktSyncEnabled } from "../utils/syncMode.js";
import { API_URL } from "../services/api.js";
import { installErrorLogging } from "../services/logs.js";

installErrorLogging();

export default function Providers({ children }) {
  React.useEffect(() => {
    // Wake the backend the moment the app opens: Render's free tier sleeps
    // when idle and takes ~40s to cold-start. Firing a throwaway request now
    // means the server is warm by the time the user picks something to
    // stream, instead of paying the cold start on their first play click.
    fetch(`${API_URL}/`, { method: "GET" }).catch(() => {});

    // Flush any operations left queued from a previous session.
    traktSyncQueue.processQueue();

    // Pull Trakt's current state down and keep it in sync going forward.
    if (isTraktSyncEnabled()) {
      traktReconciliation.reconcileNow({ trigger: "load" });
      traktReconciliation.startAutoReconcile();
    }

    return () => {
      traktReconciliation.stopAutoReconcile();
    };
  }, []);

  return (
    <AppProvider>
      <SettingsProvider>
        <PlayerProvider>
          <UpdateProvider>{children}</UpdateProvider>
        </PlayerProvider>
      </SettingsProvider>
    </AppProvider>
  );
}
