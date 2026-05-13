import { useState } from "react";
import { useSettingsContext } from "../../context/SettingsContext.jsx";
import TraktSyncToggle from "../trakt/TraktSyncToggle.jsx";
import CrossDeviceSyncIndicator from "../sync/CrossDeviceSyncIndicator.jsx";
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
    padding: "12px 16px",
    borderRadius: "12px",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "14px",
    transition: "all 0.2s ease",
    background: activeTab === tab ? "#007BFF" : "#2d2d2d",
    color: "#fff",
  });

  return (
    <div className="settings-modal-overlay">
      <div className="settings-modal-content">
        <h2>Settings</h2>

        <div
          style={{
            display: "flex",
            gap: "10px",
            marginBottom: "22px",
            flexWrap: "wrap",
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
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginBottom: "10px",
              }}
            >
              <CrossDeviceSyncIndicator />
            </div>

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
