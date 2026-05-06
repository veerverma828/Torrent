import { createContext, useContext, useState } from "react";
import { DEFAULT_ADDON_APIS, DEFAULT_DEBRID_SERVICE } from "../utils/constants.js";
import { storageService } from "../services/storageService.js";

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [addonApis, setAddonApis] = useState(() => {
    return storageService.get("addonApis") || [...DEFAULT_ADDON_APIS];
  });
  const [tempAddonApis, setTempAddonApis] = useState([]);
  const [autoSearch, setAutoSearch] = useState(true);
  const [useJackett, setUseJackett] = useState(false);
  const [imdbMode, setImdbMode] = useState(false);

  const [debridService, setDebridService] = useState(DEFAULT_DEBRID_SERVICE);
  const [rdUnlocked, setRdUnlocked] = useState(false);
  const [rdAdminCode, setRdAdminCode] = useState("");

  const value = {
    isSettingsOpen,
    setIsSettingsOpen,
    addonApis,
    setAddonApis,
    tempAddonApis,
    setTempAddonApis,
    autoSearch,
    setAutoSearch,
    useJackett,
    setUseJackett,
    imdbMode,
    setImdbMode,
    debridService,
    setDebridService,
    rdUnlocked,
    setRdUnlocked,
    rdAdminCode,
    setRdAdminCode,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettingsContext() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettingsContext must be used within SettingsProvider");
  return ctx;
}
