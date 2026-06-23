import { useState } from "react";
import { useSettingsContext } from "../../context/SettingsContext.jsx";
import TraktSyncToggle from "../trakt/TraktSyncToggle.jsx";
import ConvertLinkSection from "./ConvertLinkSection.jsx";
import { storageService } from "../../services/storageService.js";
import { DEFAULT_ADDON_APIS, API_URL } from "../../utils/constants.js";
import "./SettingsModal.css";

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

  if (!isSettingsOpen) return null;

  const handleSave = () => {
    const finalApis = tempAddonApis
      .filter((api) => api.trim() !== "")
      .map((api) => api.trim());

    setAddonApis(finalApis);
    storageService.set("addonApis", finalApis);
    setIsSettingsOpen(false);
  };

  const tabButtonStyle = (tab) => ({
    flex: 1,
    minWidth: "max-content",
    padding: "12px 10px",
    borderRadius: "14px",
    border:
      settingsTab === tab
        ? "1px solid rgba(0,123,255,0.45)"
        : "1px solid rgba(255,255,255,0.08)",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "13px",
    whiteSpace: "nowrap",
    transition: "all 0.25s ease",
    background:
      settingsTab === tab
        ? "linear-gradient(135deg, rgba(0,123,255,0.95) 0%, rgba(0,86,214,0.95) 100%)"
        : "rgba(255,255,255,0.03)",
    color: "#fff",
    boxShadow:
      settingsTab === tab
        ? "0 8px 24px rgba(0, 123, 255, 0.35)"
        : "0 2px 10px rgba(0,0,0,0.18)",
    backdropFilter: "blur(12px)",
    transform: settingsTab === tab ? "translateY(-1px) scale(1.01)" : "scale(1)",
  });

  const sectionCardStyle = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "18px",
    padding: "18px",
    backdropFilter: "blur(16px)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
  };

  return (
    <div className="settings-modal-overlay">
      <div
        className="settings-modal-content"
        style={{
          background:
            "radial-gradient(circle at top, rgba(0,123,255,0.12), transparent 42%), rgba(18,18,18,0.96)",
        }}
      >
        <h2>Settings</h2>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            marginBottom: "18px",
            padding: "8px",
            borderRadius: "18px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            width: "100%",
            boxSizing: "border-box",
            backdropFilter: "blur(14px)",
          }}
        >
          <button
            style={tabButtonStyle("addons")}
            onClick={() => setSettingsTab("addons")}
          >
            🧩 Addons
          </button>

          <button
            style={tabButtonStyle("debrid")}
            onClick={() => setSettingsTab("debrid")}
          >
            🔌 Debrid
          </button>

          <button
            style={tabButtonStyle("trakt")}
            onClick={() => setSettingsTab("trakt")}
          >
            🔄 Trakt
          </button>

          <button
            style={tabButtonStyle("convert")}
            onClick={() => setSettingsTab("convert")}
          >
            ⚡ Direct Stream
          </button>

          <button
            style={tabButtonStyle("others")}
            onClick={() => setSettingsTab("others")}
          >
            ⚙ Others
          </button>
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
                    ✖
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
                  <div style={{ marginTop: "8px", fontSize: "12px", color: rdUnlocked ? "#28a745" : "#ff4d4d", fontWeight: "bold" }}>
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
      </div>
    </div>
  );
}
