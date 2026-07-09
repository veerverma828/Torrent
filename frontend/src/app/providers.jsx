import React from "react";
import { AppProvider } from "../context/AppContext.jsx";
import { SettingsProvider } from "../context/SettingsContext.jsx";
import { PlayerProvider } from "../context/PlayerContext.jsx";
import { traktSyncQueue } from "../services/trakt/traktSyncQueue.js";
import { traktReconciliation } from "../services/trakt/traktReconciliation.js";
import { isTraktSyncEnabled } from "../utils/syncMode.js";

export default function Providers({ children }) {
  React.useEffect(() => {
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
        <PlayerProvider>{children}</PlayerProvider>
      </SettingsProvider>
    </AppProvider>
  );
}
