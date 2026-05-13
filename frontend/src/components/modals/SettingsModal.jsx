import { useState } from "react";
import { useSettingsContext } from "../../context/SettingsContext.jsx";
import TraktSyncToggle from "../trakt/TraktSyncToggle.jsx";
import { storageService } from "../../services/storageService.js";
import { DEFAULT_ADDON_APIS } from "../../utils/constants.js";

export default function SettingsModal() {
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    tempAddonApis,
    setTempAddonApis,
    setAddonApis,
    autoSearch,
    setAutoSearch,
    useJackett,
    setUseJackett,
    imdbMode,
    setImdbMode,
  } = useSettingsContext();

  const [activeTab, setActiveTab] = useState("addons");

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
    minWidth: "92px",
    padding: "11px 14px",
    borderRadius: "12px",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "14px",
    whiteSpace: "nowrap",
    transition: "all 0.25s ease",
    background:
      activeTab === tab
        ? "linear-gradient(135deg, #007BFF 0%, #0056d6 100%)"
        : "transparent",
    color: "#fff",
    boxShadow:
      activeTab === tab
        ? "0 4px 14px rgba(0, 123, 255, 0.28)"
        : "none",
  });

  return (
    <div className="settings-modal-overlay">
      <div className="settings-modal-content">
        <h2>Settings</h2>

        <div
          style={{
            display: "flex",
            gap: "6px",
            marginBottom: "18px",
            padding: "6px",
            borderRadius: "16px",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
            overflowX: "auto",
            width: "100%",
            boxSizing: "border-box",
            backdropFilter: "blur(12px)",
          }}
        >
          <button
            style={tabButtonStyle("addons")}
            onClick={() => setActiveTab("addons")}
          >
            Addons
          </button>

          <button
            style={tabButtonStyle("trakt")}
            onClick={() => setActiveTab("trakt")}
          >
            Trakt Sync
          </button>

          <button
            style={tabButtonStyle("others")}
            onClick={() => setActiveTab("others")}
          >
            Others
          </button>
        </div>

        {activeTab === "addons" && (
          <>
            <div className="settings-section">
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

        {activeTab === "trakt" && (
          <>
            <div className="settings-section">
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

        {activeTab === "others" && (
          <>
            <div className="settings-section">
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
