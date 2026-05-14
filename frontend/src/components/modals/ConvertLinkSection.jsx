import { useState } from "react";
import { useStreamActions } from "../../hooks/useStreamActions.js";

export default function ConvertLinkSection() {
  const { initAction } = useStreamActions();

  const [magnet, setMagnet] = useState("");
  const [processing, setProcessing] = useState(false);

  const handleAction = async (type) => {
    if (!magnet.trim()) {
      alert("Please paste a magnet link.");
      return;
    }

    try {
      setProcessing(true);
      await initAction(magnet.trim(), type, true);
    } catch (error) {
      console.error(error);
      alert("Failed to process magnet link.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="settings-section">
      <h3 style={{ marginBottom: "18px" }}>Convert Magnet Link</h3>

      <textarea
        value={magnet}
        onChange={(e) => setMagnet(e.target.value)}
        placeholder="Paste magnet link here..."
        style={{
          width: "100%",
          minHeight: "120px",
          resize: "vertical",
          borderRadius: "14px",
          padding: "14px",
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.04)",
          color: "#fff",
          outline: "none",
          boxSizing: "border-box",
        }}
      />

      <div
        style={{
          display: "flex",
          gap: "12px",
          marginTop: "16px",
          flexWrap: "wrap",
        }}
      >
        <button
          className="settings-save-btn"
          disabled={processing}
          onClick={() => handleAction("download")}
        >
          {processing ? "Processing..." : "Copy Download Link"}
        </button>

        <button
          className="settings-default-btn"
          disabled={processing}
          onClick={() => handleAction("external")}
        >
          Stream Externally
        </button>
      </div>
    </div>
  );
}
