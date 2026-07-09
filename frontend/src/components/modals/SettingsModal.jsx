import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Puzzle, Cable, RefreshCw, Zap, Settings as SettingsIcon, X } from "lucide-react";
import { useSettingsContext } from "../../context/SettingsContext.jsx";
import TraktSyncToggle from "../trakt/TraktSyncToggle.jsx";
import ConvertLinkSection from "./ConvertLinkSection.jsx";
import { storageService } from "../../services/storageService.js";
import { DEFAULT_ADDON_APIS, API_URL } from "../../utils/constants.js";
import "./SettingsModal.css";

const TABS = [
  { key: "addons", label: "Addons", icon: Puzzle },
  { key: "debrid", label: "Debrid", icon: Cable },
  { key: "trakt", label: "Trakt", icon: RefreshCw },
  { key: "convert", label: "Direct Stream", icon: Zap },
  { key: "others", label: "Others", icon: SettingsIcon },
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
    rdUnlocked,
    setRdUnlocked,
    rdAdminCode,
    setRdAdminCode,
  } = useSettingsContext();

  const [tempCode, setTempCode] = useState(rdAdminCode);
  const [verifyingRD, setVerifyingRD] = useState(false);

  const handleVerifyRD = async () => {
    if (!tempCode) return;
    setVerifyingRD(true);
    try {
      const res = await fetch(`${API_URL}/verify-rd`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: tempCode }),
      });

      const data = await res.json();

      if (data.success) {
        setRdUnlocked(true);
        setRdAdminCode(tempCode);
        setDebridService("real-debrid");
        alert("✅ Real-Debrid Admin access verified and unlocked!");
      } else {
        alert("❌ Verification failed: Only admin can access Real-Debrid");
        setDebridService("torbox");
      }
    } catch (err) {
      console.error(err);
      alert("Error verifying access code");
    } finally {
      setVerifyingRD(false);
    }
  };

  const handleSave = () => {
    const finalApis = tempAddonApis
      .filter((api) => api.trim() !== "")
      .map((api) => api.trim());

    setAddonApis(finalApis);
    storageService.set("addonApis", finalApis);
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
                  </button>
                );
              })}
            </div>

            {settingsTab === "addons" && (
              <>
                <div className="settings-section" style={sectionCardStyle}>
                  <h3 style={{ marginBottom: "15px" }}>Addon APIs</h3>

                  {tempAddonApis.map((api, index) => (
                    <div key={index} className="addon-input-group">
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
                  ))}

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
                    <button className="settings-save-btn" onClick={handleSave}>
                      Save
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
                        Active Service:
                      </label>
                      <div style={{ display: "flex", gap: "16px" }}>
                        <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px" }}>
                          <input
                            type="radio"
                            name="modal-debrid"
                            value="torbox"
                            checked={debridService === "torbox"}
                            onChange={() => setDebridService("torbox")}
                          />
                          Torbox
                        </label>
                        <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px" }}>
                          <input
                            type="radio"
                            name="modal-debrid"
                            value="real-debrid"
                            checked={debridService === "real-debrid"}
                            onChange={() => {
                              if (rdUnlocked) {
                                setDebridService("real-debrid");
                              } else {
                                alert("Please enter and verify your Real-Debrid admin access code below first.");
                              }
                            }}
                          />
                          Real-Debrid
                        </label>
                      </div>
                    </div>

                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "12px" }}>
                      <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px" }}>
                        Real-Debrid Admin Access Code:
                      </label>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <input
                          type="password"
                          className="addon-input"
                          value={tempCode}
                          onChange={(e) => setTempCode(e.target.value)}
                          placeholder="Enter admin code"
                        />
                        <button
                          className="addon-add-btn"
                          style={{ margin: 0, whiteSpace: "nowrap" }}
                          onClick={handleVerifyRD}
                          disabled={verifyingRD}
                        >
                          {verifyingRD ? "Verifying..." : "Verify & Save"}
                        </button>
                      </div>
                      <div style={{ marginTop: "8px", fontSize: "12px", color: rdUnlocked ? "#1db954" : "#ff4d4d", fontWeight: "bold" }}>
                        Status: {rdUnlocked ? "✅ Unlocked (Admin Authorized)" : "🔒 Locked (Torbox only)"}
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
