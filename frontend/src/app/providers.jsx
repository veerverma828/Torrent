import { AppProvider } from "../context/AppContext.jsx";
import { SettingsProvider } from "../context/SettingsContext.jsx";
import { PlayerProvider } from "../context/PlayerContext.jsx";

export default function Providers({ children }) {
  return (
    <AppProvider>
      <SettingsProvider>
        <PlayerProvider>{children}</PlayerProvider>
      </SettingsProvider>
    </AppProvider>
  );
}
