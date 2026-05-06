import { useState } from "react";
import { useSettingsContext } from "../../context/SettingsContext.jsx";
import { traktAuth } from "../../services/trakt/traktAuth.js";

export default function TraktSyncToggle() {
  const {
    syncMode,
    setSyncMode,
    traktAuthenticated,
    setTraktAuthenticated,
    traktUser,
    setTraktUser,
  } = useSettingsContext();

  const [deviceData, setDeviceData] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);

      const data = await traktAuth.startDeviceFlow();

      setDeviceData(data);

      window.open(data.verification_url, "_blank", "noopener,noreferrer");

      await traktAuth.pollForAccessToken(data.device_code, data.interval);

      setTraktAuthenticated(true);
      setTraktUser(traktAuth.getUser());
      setSyncMode("trakt");
    } catch (error) {
      console.error("Trakt connection failed", error);
      alert("Failed to connect Trakt account");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleLogout = () => {
    traktAuth.logout();
    setTraktAuthenticated(false);
    setTraktUser(null);
    setSyncMode("local");
  };

  return (
    <div
      style={{
        marginBottom: "20px",
        padding: "16px",
        borderRadius: "12px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>Sync Mode</h3>
          <p style={{ margin: "6px 0 0", opacity: 0.7, fontSize: "14px" }}>
            {syncMode === "local"
              ? "Using local device storage"
              : `Connected to Trakt${traktUser ? ` as ${traktUser.username}` : ""}`}
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            className="action-button"
            onClick={() => setSyncMode("local")}
            style={{
              background: syncMode === "local" ? "#007BFF" : "#444",
            }}
          >
            Local
          </button>

          <button
            className="action-button"
            onClick={() => {
              if (traktAuthenticated) {
                setSyncMode("trakt");
              } else {
                handleConnect();
              }
            }}
            disabled={isConnecting}
            style={{
              background: syncMode === "trakt" ? "#ed1c24" : "#444",
            }}
          >
            {isConnecting
              ? "Connecting..."
              : traktAuthenticated
                ? "Trakt"
                : "Connect Trakt"}
          </button>

          {traktAuthenticated && (
            <button
              className="action-button"
              onClick={handleLogout}
              style={{ background: "#6c757d" }}
            >
              Logout
            </button>
          )}
        </div>
      </div>

      {deviceData && !traktAuthenticated && (
        <div style={{ marginTop: "14px", fontSize: "14px", opacity: 0.85 }}>
          Authorize using code:
          <strong style={{ marginLeft: "8px", letterSpacing: "2px" }}>
            {deviceData.user_code}
          </strong>
        </div>
      )}
    </div>
  );
}
