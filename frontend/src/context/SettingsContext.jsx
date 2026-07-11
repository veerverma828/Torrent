import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { DEFAULT_ADDON_APIS, DEFAULT_DEBRID_SERVICE } from "../utils/constants.js";
import { storageService } from "../services/storageService.js";
import { traktAuth } from "../services/trakt/traktAuth.js";

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("addons");
  const [addonApis, setAddonApis] = useState(() => {
    return storageService.get("addonApis") || [...DEFAULT_ADDON_APIS];
  });
  const [tempAddonApis, setTempAddonApis] = useState([]);
  const [autoSearch, setAutoSearch] = useState(true);
  const [useJackett, setUseJackett] = useState(false);
  const [imdbMode, setImdbMode] = useState(false);

  const [debridService, setDebridServiceState] = useState(() => {
    return storageService.get("debridService") || DEFAULT_DEBRID_SERVICE;
  });
  const [rdUnlocked, setRdUnlockedState] = useState(() => {
    return storageService.get("rdUnlocked") || false;
  });
  const [rdAdminCode, setRdAdminCodeState] = useState(() => {
    return storageService.get("rdAdminCode") || "";
  });

  const setDebridService = useCallback((service) => {
    storageService.set("debridService", service);
    setDebridServiceState(service);
  }, []);

  const setRdUnlocked = useCallback((val) => {
    storageService.set("rdUnlocked", val);
    setRdUnlockedState(val);
  }, []);

  const setRdAdminCode = useCallback((code) => {
    storageService.set("rdAdminCode", code);
    setRdAdminCodeState(code);
  }, []);

  // Bring-your-own-key debrid: each service only works once the user saves
  // their own API key (persisted locally, sent per-request to the backend).
  const [realDebridApiKey, setRealDebridApiKeyState] = useState(() => {
    return storageService.get("realDebridApiKey") || "";
  });
  const [torboxApiKey, setTorboxApiKeyState] = useState(() => {
    return storageService.get("torboxApiKey") || "";
  });

  const setRealDebridApiKey = useCallback((key) => {
    storageService.set("realDebridApiKey", key);
    setRealDebridApiKeyState(key);
  }, []);

  const setTorboxApiKey = useCallback((key) => {
    storageService.set("torboxApiKey", key);
    setTorboxApiKeyState(key);
  }, []);

  // Playback source: "auto" = debrid when a key is saved else P2P; "p2p" and
  // "debrid" force one. P2P only works in the native Android app.
  const [playbackSource, setPlaybackSourceState] = useState(() => {
    return storageService.get("playbackSource") || "auto";
  });
  const setPlaybackSource = useCallback((src) => {
    storageService.set("playbackSource", src);
    setPlaybackSourceState(src);
  }, []);

  const [syncMode, setSyncMode] = useState(() => {
    return storageService.get("syncMode") || "local";
  });

  const [traktAuthenticated, setTraktAuthenticated] = useState(() => {
    return traktAuth.isAuthenticated();
  });

  const [traktUser, setTraktUser] = useState(() => {
    return traktAuth.getUser();
  });

  const updateSyncMode = useCallback((mode) => {
    storageService.set("syncMode", mode);
    setSyncMode(mode);
  }, []);

  const value = useMemo(
    () => ({
      isSettingsOpen,
      setIsSettingsOpen,
      settingsTab,
      setSettingsTab,
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
      realDebridApiKey,
      setRealDebridApiKey,
      torboxApiKey,
      setTorboxApiKey,
      playbackSource,
      setPlaybackSource,
      syncMode,
      setSyncMode: updateSyncMode,
      traktAuthenticated,
      setTraktAuthenticated,
      traktUser,
      setTraktUser,
    }),
    [
      isSettingsOpen,
      settingsTab,
      addonApis,
      tempAddonApis,
      autoSearch,
      useJackett,
      imdbMode,
      debridService,
      rdUnlocked,
      rdAdminCode,
      realDebridApiKey,
      setRealDebridApiKey,
      torboxApiKey,
      setTorboxApiKey,
      playbackSource,
      setPlaybackSource,
      syncMode,
      updateSyncMode,
      traktAuthenticated,
      traktUser,
    ]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettingsContext() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettingsContext must be used within SettingsProvider");
  return ctx;
}
