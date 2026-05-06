import { createContext, useContext, useState } from "react";
import { DEFAULT_ADDON_APIS, DEFAULT_DEBRID_SERVICE } from "../utils/constants.js";
import { storageService } from "../services/storageService.js";
import { traktAuth } from "../services/trakt/traktAuth.js";

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

  const [syncMode, setSyncMode] = useState(() => {
    return storageService.get("syncMode") || "local";
  });

  const [traktAuthenticated, setTraktAuthenticated] = useState(() => {
    return traktAuth.isAuthenticated();
  });

  const [traktUser, setTraktUser] = useState(() => {
    return traktAuth.getUser();
  });

  const updateSyncMode = (mode) => {
    storageService.set("syncMode", mode);
    setSyncMode(mode);
  };

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
    syncMode,
    setSyncMode: updateSyncMode,
    traktAuthenticated,
    setTraktAuthenticated,
    traktUser,
    setTraktUser,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettingsContext() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettingsContext must be used within SettingsProvider");
  return ctx;
}
