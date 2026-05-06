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
        padding: "18px",
        borderRadius: "14px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(10px)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "14px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>
            Trakt Sync Mode
          </h3>

          <p
            style={{
              margin: "8px 0 0",
              opacity: 0.78,
              fontSize: "14px",
              lineHeight: 1.5,
            }}
          >
            {syncMode === "local"
              ? "Using secure local device storage for watch progress and continue watching"
              : `Connected with Trakt cloud sync${traktUser ? ` as @${traktUser.username}` : ""}`}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            className="action-button"
            onClick={() => setSyncMode("local")}
            style={{
              background: syncMode === "local" ? "#007BFF" : "#444",
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
              background: syncMode === "trakt" ? "#ed1c24" : "#444",
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
              style={{ background: "#6c757d" }}
            >
              Logout
            </button>
          )}
        </div>
      </div>

      {deviceData && !traktAuthenticated && (
        <div
          style={{
            marginTop: "16px",
            fontSize: "14px",
            opacity: 0.9,
          }}
        >
          Authorize Trakt using code:
          <strong style={{ marginLeft: "10px", letterSpacing: "2px" }}>
            {deviceData.user_code}
          </strong>
        </div>
      )}
    </div>
  );
}
