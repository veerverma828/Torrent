import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Puzzle, Cable, RefreshCw, Zap, Settings as SettingsIcon, Download, X, FileWarning } from "lucide-react";
import LogsSection from "./LogsSection.jsx";
import { useSettingsContext } from "../../context/SettingsContext.jsx";
import { useUpdate } from "../../context/UpdateContext.jsx";
import TraktSyncToggle from "../trakt/TraktSyncToggle.jsx";
import ConvertLinkSection from "./ConvertLinkSection.jsx";
import UpdateSection from "./UpdateSection.jsx";
import { storageService } from "../../services/storageService.js";
import { DEFAULT_ADDON_APIS, API_URL } from "../../utils/constants.js";
import { fetchAddonManifest, storeManifest, pruneManifests, getStoredManifests } from "../../services/addonCatalogs.js";
import { showToast } from "../common/Toast.jsx";
import "./SettingsModal.css";

const TABS = [
  { key: "addons", label: "Addons", icon: Puzzle },
  { key: "debrid", label: "Debrid", icon: Cable },
  { key: "trakt", label: "Trakt", icon: RefreshCw },
  { key: "convert", label: "Direct Stream", icon: Zap },
  { key: "others", label: "Others", icon: SettingsIcon },
  { key: "logs", label: "Logs", icon: FileWarning },
  { key: "update", label: "Update", icon: Download },
];

export default function SettingsModal() {
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    settingsTab,
    setSettingsTab,
    tempAddonApis,
    setTempAddonApis,
    setAddonApis,
    autoSearch,
    setAutoSearch,
    useJackett,
    setUseJackett,
    imdbMode,
    setImdbMode,
    debridService,
    setDebridService,
    realDebridApiKey,
    setRealDebridApiKey,
    torboxApiKey,
    setTorboxApiKey,
    playbackSource,
    setPlaybackSource,
  } = useSettingsContext();

  const { update } = useUpdate();

  const [tempTorboxKey, setTempTorboxKey] = useState(torboxApiKey || "");
  const [tempRdKey, setTempRdKey] = useState(realDebridApiKey || "");
  const [verifyingKey, setVerifyingKey] = useState(null); // "torbox" | "real-debrid" | null
  const [savingAddons, setSavingAddons] = useState(false);
  const storedManifests = getStoredManifests();

  const modalRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  // Trap focus inside the modal while open, and hand it back to whatever
  // triggered the modal (e.g. the settings gear button) once it closes.
  useEffect(() => {
    if (isSettingsOpen) {
      previouslyFocusedRef.current = document.activeElement;
      const raf = requestAnimationFrame(() => {
        const first = modalRef.current?.querySelector("button, input, [tabindex='0']");
        first?.focus({ preventScroll: true });
      });

      const handleEscape = (e) => {
        if (e.key === "Escape") setIsSettingsOpen(false);
      };
      window.addEventListener("keydown", handleEscape);

      return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("keydown", handleEscape);
        const prev = previouslyFocusedRef.current;
        if (prev && document.contains(prev)) prev.focus({ preventScroll: true });
      };
    }
  }, [isSettingsOpen, setIsSettingsOpen]);

  // Verify the pasted key against the provider, then persist it locally.
  const handleSaveDebridKey = async (service) => {
    const key = (service === "torbox" ? tempTorboxKey : tempRdKey).trim();
    if (!key) {
      showToast("Paste an API key first");
      return;
    }
    setVerifyingKey(service);
    try {
      const res = await fetch(`${API_URL}/verify-debrid`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-debrid-key": key },
        body: JSON.stringify({ service }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        if (service === "torbox") setTorboxApiKey(key);
        else setRealDebridApiKey(key);
        setDebridService(service);
        showToast(
          `${service === "torbox" ? "Torbox" : "Real-Debrid"} key verified${data.username ? ` (${data.username})` : ""}`,
          "success"
        );
      } else {
        showToast(data.message || "Invalid API key");
      }
    } catch (err) {
      console.error(err);
      showToast("Could not verify — server unreachable (it may be waking up)");
    } finally {
      setVerifyingKey(null);
    }
  };

  const handleSave = async () => {
    const entered = [...new Set(
      tempAddonApis.map((api) => api.trim()).filter((api) => api !== "")
    )];

    // Validate every non-default addon by fetching its manifest. Known-good
    // (already stored) manifests are skipped so saving stays instant.
    setSavingAddons(true);
    const finalApis = [];
    const known = getStoredManifests();
    try {
      for (const api of entered) {
        if (DEFAULT_ADDON_APIS.includes(api)) {
          finalApis.push(api);
          continue;
        }
        const manifestUrl = /manifest\.json$/i.test(api)
          ? api
          : `${api.replace(/\/$/, "")}/manifest.json`;
        if (known[manifestUrl]) {
          finalApis.push(manifestUrl);
          continue;
        }
        try {
          const info = await fetchAddonManifest(api);
          storeManifest(info);
          finalApis.push(info.url);
          showToast(`Addon installed: ${info.name}`, "success");
        } catch (err) {
          showToast(`"${api.slice(0, 40)}…": ${err.message}`);
          setSavingAddons(false);
          return; // keep the modal open so the user can fix the URL
        }
      }
    } finally {
      setSavingAddons(false);
    }

    setAddonApis(finalApis);
    storageService.set("addonApis", finalApis);
    pruneManifests(finalApis);
    setIsSettingsOpen(false);
  };

  const sectionCardStyle = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "18px",
    padding: "18px",
    backdropFilter: "blur(16px)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
  };

  return (
    <AnimatePresence>
      {isSettingsOpen && (
        <motion.div
          className="settings-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            ref={modalRef}
            data-modal-trap="true"
            role="dialog"
            aria-modal="true"
            className="settings-modal-content"
            style={{
              background:
                "radial-gradient(circle at top, rgba(229,9,20,0.12), transparent 42%), rgba(18,18,18,0.96)",
            }}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-[#333]">
              <h2 className="!m-0 !border-0 !p-0">Settings</h2>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="flex items-center justify-center w-8 h-8 rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover transition-colors"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div
              className="grid gap-2 mb-4.5 p-2 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))" }}
            >
              {TABS.map(({ key, label, icon: Icon }) => {
                const isActive = settingsTab === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSettingsTab(key)}
                    className={`relative inline-flex items-center justify-center gap-1.5 px-2.5 py-3 rounded-[14px] font-semibold text-[13px] whitespace-nowrap transition-colors ${
                      isActive ? "text-white" : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 rounded-[14px] bg-gradient-to-br from-accent-primary to-accent-primary-active shadow-[0_8px_24px_rgba(229,9,20,0.35)] -z-10"
                        layoutId="settings-tab-pill"
                        transition={{ type: "spring", duration: 0.4, bounce: 0.2 }}
                      />
                    )}
                    <Icon size={14} />
                    {label}
                    {key === "update" && update && (
                      <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-accent-primary border border-bg-base" />
                    )}
                  </button>
                );
              })}
            </div>

            {settingsTab === "addons" && (
              <>
                <div className="settings-section" style={sectionCardStyle}>
                  <h3 style={{ marginBottom: "15px" }}>Addon APIs</h3>

                  {tempAddonApis.map((api, index) => {
                    const info = storedManifests[api.trim()];
                    return (
                      <div key={index}>
                        <div className="addon-input-group">
                          <input
                            type="text"
                            className="addon-input"
                            value={api}
                            onChange={(e) => {
                              const newApis = [...tempAddonApis];
                              newApis[index] = e.target.value;
                              setTempAddonApis(newApis);
                            }}
                            placeholder="https://example.addon.com/manifest.json"
                          />

                          <button
                            className="addon-remove-btn"
                            onClick={() => {
                              const newApis = tempAddonApis.filter((_, i) => i !== index);
                              setTempAddonApis(newApis);
                            }}
                            title="Remove API"
                          >
                            <X size={16} />
                          </button>
                        </div>
                        {info && (
                          <div style={{ fontSize: 12, color: "#1db954", margin: "-6px 0 10px 4px" }}>
                            ✓ {info.name}
                            {info.catalogs?.length > 0 && ` · ${info.catalogs.length} catalog${info.catalogs.length > 1 ? "s" : ""}`}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <button
                    className="addon-add-btn"
                    onClick={() => setTempAddonApis([...tempAddonApis, ""])}
                  >
                    + Add API
                  </button>
                </div>

                <div className="settings-actions">
                  <button
                    className="settings-default-btn"
                    onClick={() => {
                      setTempAddonApis([...DEFAULT_ADDON_APIS]);
                    }}
                  >
                    Restore Default
                  </button>

                  <div className="settings-actions-right">
                    <button className="settings-save-btn" onClick={handleSave} disabled={savingAddons}>
                      {savingAddons ? "Validating…" : "Save"}
                    </button>

                    <button
                      className="settings-cancel-btn"
                      onClick={() => setIsSettingsOpen(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </>
            )}

            {settingsTab === "debrid" && (
              <>
                <div className="settings-section" style={sectionCardStyle}>
                  <h3 style={{ marginBottom: "15px" }}>Debrid Integration</h3>

                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div>
                      <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px" }}>
                        Playback Source:
                      </label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "14px" }}>
                        {[
                          { value: "auto", label: "Auto" },
                          { value: "p2p", label: "P2P (torrent)" },
                          { value: "debrid", label: "Debrid" },
                        ].map((opt) => (
                          <label key={opt.value} style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px" }}>
                            <input
                              type="radio"
                              name="playback-source"
                              value={opt.value}
                              checked={playbackSource === opt.value}
                              onChange={() => setPlaybackSource(opt.value)}
                            />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                      <div style={{ marginTop: "6px", fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>
                        Auto streams via debrid when a key is saved, otherwise peer-to-peer.
                        P2P works only in the Android app.
                      </div>
                    </div>

                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "12px" }}>
                      <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px" }}>
                        Active Debrid Service:
                      </label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
                        <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px" }}>
                          <input
                            type="radio"
                            name="modal-debrid"
                            value="torbox"
                            checked={debridService === "torbox"}
                            onChange={() => {
                              if (torboxApiKey) setDebridService("torbox");
                              else showToast("Save your Torbox API key below first");
                            }}
                          />
                          Torbox {torboxApiKey ? "✓" : "(needs key)"}
                        </label>
                        <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px" }}>
                          <input
                            type="radio"
                            name="modal-debrid"
                            value="real-debrid"
                            checked={debridService === "real-debrid"}
                            onChange={() => {
                              if (realDebridApiKey) setDebridService("real-debrid");
                              else showToast("Save your Real-Debrid API key below first");
                            }}
                          />
                          Real-Debrid {realDebridApiKey ? "✓" : "(needs key)"}
                        </label>
                      </div>
                    </div>

                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "12px" }}>
                      <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px" }}>
                        Torbox API Key:
                      </label>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <input
                          type="password"
                          className="addon-input"
                          value={tempTorboxKey}
                          onChange={(e) => setTempTorboxKey(e.target.value)}
                          placeholder="Paste your Torbox API key"
                        />
                        <button
                          className="addon-add-btn"
                          style={{ margin: 0, whiteSpace: "nowrap" }}
                          onClick={() => handleSaveDebridKey("torbox")}
                          disabled={verifyingKey === "torbox"}
                        >
                          {verifyingKey === "torbox" ? "Verifying..." : "Verify & Save"}
                        </button>
                      </div>
                      {torboxApiKey && (
                        <div style={{ marginTop: "6px", fontSize: "12px", color: "#1db954", fontWeight: "bold" }}>
                          ✓ Torbox key saved
                          <button
                            style={{ marginLeft: 10, color: "#ff4d4d", background: "none", border: "none", cursor: "pointer", fontSize: "12px" }}
                            onClick={() => { setTorboxApiKey(""); setTempTorboxKey(""); }}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>

                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "12px" }}>
                      <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px" }}>
                        Real-Debrid API Key:
                      </label>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <input
                          type="password"
                          className="addon-input"
                          value={tempRdKey}
                          onChange={(e) => setTempRdKey(e.target.value)}
                          placeholder="Paste your Real-Debrid API key"
                        />
                        <button
                          className="addon-add-btn"
                          style={{ margin: 0, whiteSpace: "nowrap" }}
                          onClick={() => handleSaveDebridKey("real-debrid")}
                          disabled={verifyingKey === "real-debrid"}
                        >
                          {verifyingKey === "real-debrid" ? "Verifying..." : "Verify & Save"}
                        </button>
                      </div>
                      {realDebridApiKey && (
                        <div style={{ marginTop: "6px", fontSize: "12px", color: "#1db954", fontWeight: "bold" }}>
                          ✓ Real-Debrid key saved
                          <button
                            style={{ marginLeft: 10, color: "#ff4d4d", background: "none", border: "none", cursor: "pointer", fontSize: "12px" }}
                            onClick={() => { setRealDebridApiKey(""); setTempRdKey(""); }}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                      <div style={{ marginTop: "8px", fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>
                        Keys are stored only on this device and sent directly with your requests.
                        Get them from torbox.app/settings or real-debrid.com/apitoken.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="settings-actions" style={{ justifyContent: "flex-end" }}>
                  <button
                    className="settings-cancel-btn"
                    onClick={() => setIsSettingsOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </>
            )}

            {settingsTab === "trakt" && (
              <>
                <div className="settings-section" style={sectionCardStyle}>
                  <TraktSyncToggle />
                </div>

                <div className="settings-actions" style={{ justifyContent: "flex-end" }}>
                  <button
                    className="settings-cancel-btn"
                    onClick={() => setIsSettingsOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </>
            )}

            {settingsTab === "convert" && (
              <>
                <div style={sectionCardStyle}>
                  <ConvertLinkSection />
                </div>

                <div className="settings-actions" style={{ justifyContent: "flex-end" }}>
                  <button
                    className="settings-cancel-btn"
                    onClick={() => setIsSettingsOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </>
            )}

            {settingsTab === "others" && (
              <>
                <div className="settings-section" style={sectionCardStyle}>
                  <h3 style={{ marginBottom: "18px" }}>Search Options</h3>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "14px",
                    }}
                  >
                    <label>
                      <input
                        type="checkbox"
                        checked={autoSearch}
                        onChange={() => setAutoSearch(!autoSearch)}
                      />
                      {" "}Auto Search
                    </label>

                    <label>
                      <input
                        type="checkbox"
                        checked={useJackett}
                        onChange={() => setUseJackett(!useJackett)}
                      />
                      {" "}Jackett
                    </label>

                    <label>
                      <input
                        type="checkbox"
                        checked={imdbMode}
                        onChange={() => setImdbMode(!imdbMode)}
                      />
                      {" "}IMDb Mode
                    </label>
                  </div>
                </div>

                <div className="settings-section" style={sectionCardStyle}>
                  <h3 style={{ marginBottom: "10px" }}>Open Source Licenses</h3>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", margin: 0 }}>
                    P2P streaming is powered by{" "}
                    <a
                      href="https://github.com/YouROK/TorrServer"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#e50914" }}
                    >
                      TorrServer
                    </a>
                    , licensed under GPLv3. Source code, license text, and modifications (none
                    made) are available at the link above.
                  </p>
                </div>

                <div className="settings-actions" style={{ justifyContent: "flex-end" }}>
                  <button
                    className="settings-cancel-btn"
                    onClick={() => setIsSettingsOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </>
            )}

            {settingsTab === "logs" && (
              <>
                <div className="settings-section" style={sectionCardStyle}>
                  <h3 style={{ marginBottom: "15px" }}>Diagnostic Logs</h3>
                  <LogsSection />
                </div>

                <div className="settings-actions" style={{ justifyContent: "flex-end" }}>
                  <button
                    className="settings-cancel-btn"
                    onClick={() => setIsSettingsOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </>
            )}

            {settingsTab === "update" && (
              <>
                <UpdateSection />

                <div className="settings-actions" style={{ justifyContent: "flex-end" }}>
                  <button
                    className="settings-cancel-btn"
                    onClick={() => setIsSettingsOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
