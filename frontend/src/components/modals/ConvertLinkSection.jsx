import { useState } from "react";
import { useStreamActions } from "../../hooks/useStreamActions.js";
import { useSettingsContext } from "../../context/SettingsContext.jsx";
import { getFiles, generateLink } from "../../services/torrentService.js";

export default function ConvertLinkSection() {
  const { initAction } = useStreamActions();
  const { debridService, rdAdminCode } = useSettingsContext();

  const [magnet, setMagnet] = useState("");
  const [processing, setProcessing] = useState(false);

  const handleCopyDownloadLink = async () => {
    if (!magnet.trim()) {
      alert("Please paste a magnet link.");
      return;
    }

    try {
      setProcessing(true);

      const fileData = await getFiles(
        magnet.trim(),
        debridService,
        rdAdminCode,
      );

      if (!fileData?.files?.length) {
        alert("No files found for this magnet link.");
        return;
      }

      const generated = await generateLink(
        fileData.torrentId,
        fileData.files[0].id,
        debridService,
        rdAdminCode,
      );

      if (!generated?.downloadUrl) {
        alert("Failed to generate download link.");
        return;
      }

      await navigator.clipboard.writeText(generated.downloadUrl);
      alert("Download link copied successfully.");
    } catch (error) {
      console.error(error);
      alert("Failed to process magnet link.");
    } finally {
      setProcessing(false);
    }
  };

  const handleExternalStream = async () => {
    if (!magnet.trim()) {
      alert("Please paste a magnet link.");
      return;
    }

    try {
      setProcessing(true);
      await initAction(magnet.trim(), "external", true);
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
          onClick={handleCopyDownloadLink}
        >
          {processing ? "Processing..." : "Copy Download Link"}
        </button>

        <button
          className="settings-default-btn"
          disabled={processing}
          onClick={handleExternalStream}
        >
          Stream Externally
        </button>
      </div>
    </div>
  );
}
