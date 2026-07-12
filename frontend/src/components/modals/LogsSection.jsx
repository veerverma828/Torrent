import { useEffect, useState } from "react";
import { getCombinedLogs, clearAllLogs } from "../../services/logs.js";
import { showToast } from "../common/Toast.jsx";

/**
 * Core diagnostic feature: shows the persistent crash/error log (native
 * AppLogger.java on Android, plus any JS-side errors) so a bug that's
 * otherwise invisible — the app silently closing, a P2P stream failing with
 * no visible reason — can be captured and handed over for debugging without
 * needing adb/logcat access.
 */
export default function LogsSection() {
  const [logs, setLogs] = useState("Loading…");
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      setLogs(await getCombinedLogs());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(logs);
      showToast("Logs copied to clipboard", "success");
    } catch {
      showToast("Could not copy — try selecting the text manually");
    }
  };

  const handleClear = async () => {
    await clearAllLogs();
    showToast("Logs cleared", "success");
    refresh();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", margin: 0 }}>
        Records app errors and crashes, including ones that close the app before you can see
        what happened. Copy this and share it if something goes wrong.
      </p>

      <textarea
        readOnly
        value={logs}
        style={{
          width: "100%",
          minHeight: 260,
          maxHeight: "40vh",
          resize: "vertical",
          fontFamily: "monospace",
          fontSize: 11,
          lineHeight: 1.4,
          background: "#0d0d0d",
          color: "#ddd",
          border: "1px solid #333",
          borderRadius: 8,
          padding: 10,
          boxSizing: "border-box",
        }}
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <button type="button" className="addon-add-btn" style={{ margin: 0 }} onClick={handleCopy}>
          Copy to Clipboard
        </button>
        <button type="button" className="addon-add-btn" style={{ margin: 0 }} onClick={refresh} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
        <button
          type="button"
          className="addon-add-btn"
          style={{ margin: 0, color: "#ff6b6b" }}
          onClick={handleClear}
        >
          Clear Logs
        </button>
      </div>
    </div>
  );
}
