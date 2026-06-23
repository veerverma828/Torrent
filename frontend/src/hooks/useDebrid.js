import { useSettingsContext } from "../context/SettingsContext.jsx";

export function useDebrid() {
  const {
    debridService,
    setDebridService,
    rdUnlocked,
    setIsSettingsOpen,
    setSettingsTab,
  } = useSettingsContext();

  async function handleDebridChange(service) {
    if (service === "real-debrid") {
      if (rdUnlocked) {
        setDebridService("real-debrid");
      } else {
        setSettingsTab("debrid");
        setIsSettingsOpen(true);
      }
    } else {
      setDebridService(service);
    }
  }

  return {
    debridService,
    handleDebridChange,
    rdUnlocked,
  };
}
