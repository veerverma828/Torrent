import React from "react";
import { AppProvider } from "../context/AppContext.jsx";
import { SettingsProvider } from "../context/SettingsContext.jsx";
import { PlayerProvider } from "../context/PlayerContext.jsx";
import { syncQueueService } from "../services/syncQueueService.js";

export default function Providers({ children }) {
  // Initialize sync queue processing on app startup
  React.useEffect(() => {
    // Process any queued operations when app starts
    syncQueueService.processQueue();
  }, []);

  return (
    <AppProvider>
      <SettingsProvider>
        <PlayerProvider>{children}</PlayerProvider>
      </SettingsProvider>
    </AppProvider>
  );
}
