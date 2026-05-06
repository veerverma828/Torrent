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
  } = useSettingsContext();

  if (!isSettingsOpen) return null;

  const handleSave = () => {
    const finalApis = tempAddonApis
      .filter((api) => api.trim() !== "")
      .map((api) => api.trim());
    setAddonApis(finalApis);
    storageService.set("addonApis", finalApis);
    setIsSettingsOpen(false);
  };

  return (
    <div className="settings-modal-overlay">
      <div className="settings-modal-content">
        <h2>Settings</h2>

        <div className="settings-section">
          <TraktSyncToggle />
        </div>

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
      </div>
    </div>
  );
}
