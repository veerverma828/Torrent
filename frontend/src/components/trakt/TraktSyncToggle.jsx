import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { motion } from "framer-motion";
import { WifiOff, RefreshCw, CheckCircle2, Copy, Check } from "lucide-react";
import { useSettingsContext } from "../../context/SettingsContext.jsx";
import { traktAuth } from "../../services/trakt/traktAuth.js";
import { traktReconciliation } from "../../services/trakt/traktReconciliation.js";
import { traktSyncQueue } from "../../services/trakt/traktSyncQueue.js";
import { getStorage } from "../../trackers/progressTracker.js";
import { useSyncStatus } from "../../hooks/useSyncStatus.js";
import CrossDeviceSyncIndicator from "../sync/CrossDeviceSyncIndicator.jsx";

// Pull Trakt's existing state down first, then push whatever local-only
// progress/history exists so nothing already on this device is silently
// dropped when switching into Trakt mode.
async function performInitialTraktSync() {
  await traktReconciliation.reconcileNow({ trigger: "connect" });

  const { movies, series } = getStorage();
  const historyMovies = [];
  const historyEpisodes = [];

  for (const [id, movie] of Object.entries(movies)) {
    if (!movie.percentage || movie.percentage <= 0) continue;

    if (movie.completed) {
      historyMovies.push({ imdbId: id });
    } else {
      traktSyncQueue.enqueue({
        action: "syncProgress",
        metadata: { type: "movie", id, imdbId: id, title: movie.title },
        percentage: movie.percentage,
      });
    }
  }

  for (const [seriesId, seriesData] of Object.entries(series)) {
    for (const [season, seasonData] of Object.entries(seriesData.seasons || {})) {
      for (const [episode, ep] of Object.entries(seasonData.episodes || {})) {
        if (!ep.percentage || ep.percentage <= 0) continue;

        if (ep.completed) {
          historyEpisodes.push({ imdbId: seriesId, season, episode });
        } else {
          traktSyncQueue.enqueue({
            action: "syncProgress",
            metadata: {
              type: "series",
              id: seriesId,
              imdbId: seriesId,
              season,
              episode,
              title: seriesData.title,
            },
            percentage: ep.percentage,
          });
        }
      }
    }
  }

  if (historyMovies.length > 0 || historyEpisodes.length > 0) {
    traktSyncQueue.enqueue({
      action: "addToHistory",
      movies: historyMovies,
      episodes: historyEpisodes,
    });
  }

  traktReconciliation.startAutoReconcile();
}

export default function TraktSyncToggle() {
  const {
    syncMode,
    setSyncMode,
    traktAuthenticated,
    setTraktAuthenticated,
    traktUser,
    setTraktUser,
  } = useSettingsContext();
  
  const { isOnline, isSyncing, queueLength, hasIssues, retrySync } = useSyncStatus();

  const [deviceData, setDeviceData] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);

      const data = await traktAuth.startDeviceFlow();

      setDeviceData(data);

      await traktAuth.pollForAccessToken(data.device_code, data.interval);

      setTraktAuthenticated(true);
      setTraktUser(traktAuth.getUser());
      setSyncMode("trakt");

      await performInitialTraktSync();
    } catch (error) {
      console.error("Trakt connection failed", error);
      alert(error?.message || "Failed to connect Trakt account");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleLogout = () => {
    traktReconciliation.stopAutoReconcile();
    traktAuth.logout();
    setTraktAuthenticated(false);
    setTraktUser(null);
    setSyncMode("local");
    setDeviceData(null);
  };

  const copyUserCode = async () => {
    if (deviceData?.user_code) {
      try {
        await navigator.clipboard.writeText(deviceData.user_code);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
        console.log('Code copied to clipboard');
      } catch (err) {
        console.error('Failed to copy code:', err);
      }
    }
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
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            marginBottom: "10px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "999px",
                background: syncMode === "trakt" ? "#e50914" : "#007BFF",
                boxShadow:
                  syncMode === "trakt"
                    ? "0 0 10px rgba(229,9,20,0.7)"
                    : "0 0 10px rgba(0,123,255,0.7)",
              }}
            />

            <h3
              style={{
                margin: 0,
                fontSize: "20px",
                fontWeight: 700,
                letterSpacing: "0.2px",
                wordBreak: "break-word",
              }}
            >
              Trakt Sync Mode
            </h3>
          </div>

          <CrossDeviceSyncIndicator />
        </div>

        <p
          style={{
            margin: 0,
            opacity: 0.82,
            fontSize: "14px",
            lineHeight: 1.6,
            wordBreak: "break-word",
          }}
        >
          {syncMode === "local"
            ? "Your watch progress is currently stored securely on this device."
            : `Cloud sync enabled with Trakt${traktUser ? ` • @${traktUser.username}` : ""}`}
        </p>
        
        {syncMode === "trakt" && (
          <div
            style={{
              marginTop: "10px",
              padding: "8px 12px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: "500",
              background: hasIssues
                ? "rgba(229, 9, 20, 0.1)"
                : isSyncing
                  ? "rgba(0, 123, 255, 0.1)"
                  : "rgba(29, 185, 84, 0.1)",
              color: hasIssues
                ? "#e50914"
                : isSyncing
                  ? "#007BFF"
                  : "#1db954",
              border: `1px solid ${
                hasIssues
                  ? "rgba(229, 9, 20, 0.3)"
                  : isSyncing
                    ? "rgba(0, 123, 255, 0.3)"
                    : "rgba(29, 185, 84, 0.3)"
              }`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px"
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {!isOnline ? (
                <>
                  <WifiOff size={13} /> Offline
                </>
              ) : isSyncing ? (
                <>
                  <motion.span
                    style={{ display: "flex" }}
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  >
                    <RefreshCw size={13} />
                  </motion.span>
                  Syncing ({queueLength} items)
                </>
              ) : (
                <>
                  <CheckCircle2 size={13} /> Synced
                </>
              )}
            </span>
            {hasIssues && (
              <button
                onClick={retrySync}
                style={{
                  background: "none",
                  border: "none",
                  color: "#e50914",
                  cursor: "pointer",
                  fontSize: "11px",
                  textDecoration: "underline",
                  padding: 0
                }}
              >
                Retry
              </button>
            )}
          </div>
        )}
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
              if (syncMode !== "trakt") {
                setSyncMode("trakt");
                performInitialTraktSync();
              }
            } else {
              handleConnect();
            }
          }}
          disabled={isConnecting}
          style={{
            ...buttonBaseStyle,
            background: syncMode === "trakt" ? "#e50914" : "#3f3f46",
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
        <div style={{background: "rgba(255,255,255,0.04)",border: "1px solid rgba(255,255,255,0.08)",borderRadius: "14px",padding: "18px",fontSize: "14px",lineHeight: 1.5,display: "flex",flexDirection: "column",alignItems: "center",gap: "14px",textAlign: "center",width: "100%",boxSizing: "border-box",overflow: "hidden"}}>
          <div style={{opacity: 0.85,maxWidth: "100%"}}>
            Scan the QR code or open the activation link manually.
          </div>

          <div style={{background: "white",padding: "12px",borderRadius: "18px",width: "fit-content",maxWidth: "100%"}}>
            <QRCodeSVG
              value={deviceData.verification_url}
              size={window.innerWidth < 480 ? 150 : 180}
              includeMargin
            />
          </div>

          <a
            href={deviceData.verification_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{color: "#fff",fontWeight: 600,textDecoration: "underline",wordBreak: "break-word",overflowWrap: "break-word",maxWidth: "100%"}}
          >
            Open Trakt Activation Page
          </a>

          <div style={{ opacity: 0.75 }}>Enter this code:</div>

          <div style={{display: "flex",alignItems: "center",gap: "8px",justifyContent: "center"}}>
            <strong style={{fontSize: window.innerWidth < 480 ? "20px" : "24px",letterSpacing: window.innerWidth < 480 ? "2px" : "4px",color: "#fff",wordBreak: "break-word",textAlign: "center"}}>
              {deviceData.user_code}
            </strong>
            <button
              onClick={copyUserCode}
              style={{background: copiedCode ? "rgba(29, 185, 84, 0.3)" : "rgba(255,255,255,0.1)",border: copiedCode ? "1px solid rgba(29, 185, 84, 0.5)" : "1px solid rgba(255,255,255,0.2)",borderRadius: "6px",padding: "4px 8px",cursor: "pointer",display: "flex",alignItems: "center",color: "#fff",transition: "background 0.2s ease"}}
              title={copiedCode ? "Code copied!" : "Copy code to clipboard"}
            >
              {copiedCode ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
