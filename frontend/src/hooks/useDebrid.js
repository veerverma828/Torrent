import { useSettingsContext } from "../context/SettingsContext.jsx";
import { showToast } from "../components/common/Toast.jsx";

export function useDebrid() {
  const {
    debridService,
    setDebridService,
    realDebridApiKey,
    torboxApiKey,
    setIsSettingsOpen,
    setSettingsTab,
  } = useSettingsContext();

  // A service is usable only once the user has saved their own API key.
  function handleDebridChange(service) {
    const hasKey = service === "real-debrid" ? !!realDebridApiKey : !!torboxApiKey;
    if (hasKey) {
      setDebridService(service);
    } else {
      showToast(`Add your ${service === "real-debrid" ? "Real-Debrid" : "Torbox"} API key first`);
      setSettingsTab("debrid");
      setIsSettingsOpen(true);
    }
  }

  return {
    debridService,
    handleDebridChange,
  };
}
