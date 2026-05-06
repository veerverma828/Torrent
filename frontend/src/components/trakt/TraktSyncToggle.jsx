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

  const buttonBaseStyle = {
    flex: 1,
    minWidth: "140px",
    border: "none",
    borderRadius: "12px",
    padding: "12px 14px",
    fontWeight: 600,
    color: "#fff",
    cursor: "pointer",
    transition: "all 0.2s ease",
  };

  return (
    <div
      style={{
        marginBottom: "20px",
        padding: "20px",
        borderRadius: "18px",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(12px)",
        display: "flex",
        flexDirection: "column",
        gap: "18px",
      }}
    >
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "10px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "999px",
              background: syncMode === "trakt" ? "#ed1c24" : "#007BFF",
              boxShadow:
                syncMode === "trakt"
                  ? "0 0 10px rgba(237,28,36,0.7)"
                  : "0 0 10px rgba(0,123,255,0.7)",
            }}
          />

          <h3
            style={{
              margin: 0,
              fontSize: "20px",
              fontWeight: 700,
              letterSpacing: "0.2px",
            }}
          >
            Trakt Sync Mode
          </h3>
        </div>

        <p
          style={{
            margin: 0,
            opacity: 0.82,
            fontSize: "14px",
            lineHeight: 1.6,
          }}
        >
          {syncMode === "local"
            ? "Your watch progress is currently stored securely on this device."
            : `Cloud sync enabled with Trakt${traktUser ? ` • @${traktUser.username}` : ""}`}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          width: "100%",
        }}
      >
        <button
          className="action-button"
          onClick={() => setSyncMode("local")}
          style={{
            ...buttonBaseStyle,
            background: syncMode === "local" ? "#007BFF" : "#3f3f46",
          }}
        >
          Local Storage
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
            ...buttonBaseStyle,
            background: syncMode === "trakt" ? "#ed1c24" : "#3f3f46",
          }}
        >
          {isConnecting
            ? "Connecting..."
            : traktAuthenticated
              ? "Trakt Synced"
              : "Connect Trakt"}
        </button>

        {traktAuthenticated && (
          <button
            className="action-button"
            onClick={handleLogout}
            style={{
              ...buttonBaseStyle,
              background: "#5a5a5a",
            }}
          >
            Logout
          </button>
        )}
      </div>

      {deviceData && !traktAuthenticated && (
        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "14px",
            padding: "14px",
            fontSize: "14px",
            lineHeight: 1.5,
          }}
        >
          <div style={{ opacity: 0.8, marginBottom: "8px" }}>
            Authorize Trakt using this code:
          </div>

          <strong
            style={{
              fontSize: "20px",
              letterSpacing: "3px",
              color: "#fff",
            }}
          >
            {deviceData.user_code}
          </strong>
        </div>
      )}
    </div>
  );
}
