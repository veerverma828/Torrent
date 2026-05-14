import { useState } from "react";
import { useStreamActions } from "../../hooks/useStreamActions.js";
import { useSettingsContext } from "../../context/SettingsContext.jsx";
import { getFiles, generateLink } from "../../services/torrentService.js";

const textareaStyle = {
  width: "100%",
  minHeight: "120px",
  maxHeight: "260px",
  resize: "vertical",
  borderRadius: "14px",
  padding: "14px",
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.04)",
  color: "#fff",
  outline: "none",
  boxSizing: "border-box",
  overflowY: "auto",
  lineHeight: "1.5",
};

const actionButtonStyle = {
  minWidth: "190px",
  minHeight: "46px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flex: 1,
};

export default function ConvertLinkSection() {
  const { initAction } = useStreamActions();
  const { debridService, rdAdminCode } = useSettingsContext();

  const [magnet, setMagnet] = useState("");
  const [copyProcessing, setCopyProcessing] = useState(false);
  const [streamProcessing, setStreamProcessing] = useState(false);

  const handleCopyDownloadLink = async () => {
    if (!magnet.trim()) {
      alert("Please paste a magnet link.");
      return;
    }

    try {
      setCopyProcessing(true);

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
      setCopyProcessing(false);
    }
  };

  const handleExternalStream = async () => {
    if (!magnet.trim()) {
      alert("Please paste a magnet link.");
      return;
    }

    try {
      setStreamProcessing(true);
      await initAction(magnet.trim(), "external", true);
    } catch (error) {
      console.error(error);
      alert("Failed to process magnet link.");
    } finally {
      setStreamProcessing(false);
    }
  };

  return (
    <div
      className="settings-section"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div>
        <h3 style={{ marginBottom: "8px" }}>Convert Magnet Link</h3>

        <p
          style={{
            margin: 0,
            opacity: 0.7,
            fontSize: "14px",
            lineHeight: "1.5",
          }}
        >
          Convert magnet links using your selected debrid provider.
        </p>
      </div>

      <textarea
        value={magnet}
        onChange={(e) => setMagnet(e.target.value)}
        placeholder="Paste magnet link here..."
        style={textareaStyle}
      />

      <div
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          alignItems: "stretch",
        }}
      >
        <button
          className="settings-save-btn"
          disabled={copyProcessing}
          onClick={handleCopyDownloadLink}
          style={actionButtonStyle}
        >
          {copyProcessing ? "Processing Link..." : "Copy Download Link"}
        </button>

        <button
          className="settings-default-btn"
          disabled={streamProcessing}
          onClick={handleExternalStream}
          style={actionButtonStyle}
        >
          {streamProcessing ? "Opening Stream..." : "Stream Externally"}
        </button>
      </div>
    </div>
  );
}
