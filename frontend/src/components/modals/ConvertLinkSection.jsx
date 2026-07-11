import { useMemo, useState } from "react";
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
  const {
    debridService,
    realDebridApiKey,
    torboxApiKey,
    setIsSettingsOpen,
  } = useSettingsContext();
  const debridKey = debridService === "real-debrid" ? realDebridApiKey : torboxApiKey;

  const [inputValue, setInputValue] = useState("");
  const [copyProcessing, setCopyProcessing] = useState(false);
  const [streamProcessing, setStreamProcessing] = useState(false);
  const [externalProcessing, setExternalProcessing] = useState(false);

  const isDirectUrl = useMemo(() => {
    const value = inputValue.trim().toLowerCase();
    return value.startsWith("http://") || value.startsWith("https://");
  }, [inputValue]);

  const handleCopyDownloadLink = async () => {
    if (!inputValue.trim()) {
      alert("Please paste a magnet link.");
      return;
    }

    try {
      setCopyProcessing(true);

      const fileData = await getFiles(
        inputValue.trim(),
        debridService,
        debridKey,
      );

      if (!fileData?.files?.length) {
        alert("No files found for this magnet link.");
        return;
      }

      const generated = await generateLink(
        fileData.torrentId,
        fileData.files[0].id,
        debridService,
        debridKey,
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

  const handleInternalStream = async () => {
    if (!inputValue.trim()) {
      alert("Please paste a stream URL.");
      return;
    }

    try {
      setStreamProcessing(true);
      setIsSettingsOpen(false);
      await initAction(inputValue.trim(), "stream", true);
    } catch (error) {
      console.error(error);
      alert("Failed to open stream.");
    } finally {
      setStreamProcessing(false);
    }
  };

  const handleExternalStream = async () => {
    if (!inputValue.trim()) {
      alert(isDirectUrl ? "Please paste a stream URL." : "Please paste a magnet link.");
      return;
    }

    try {
      setExternalProcessing(true);
      await initAction(inputValue.trim(), "external", true);
    } catch (error) {
      console.error(error);
      alert("Failed to process link.");
    } finally {
      setExternalProcessing(false);
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
        <h3 style={{ marginBottom: "8px" }}>
          {isDirectUrl ? "Direct Stream Link" : "Convert Magnet Link"}
        </h3>

        <p
          style={{
            margin: 0,
            opacity: 0.7,
            fontSize: "14px",
            lineHeight: "1.5",
          }}
        >
          {isDirectUrl
            ? "Stream direct media URLs instantly using the built-in player or external apps."
            : "Convert magnet links using your selected debrid provider."}
        </p>
      </div>

      <textarea
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={
          isDirectUrl
            ? "Paste direct stream URL here..."
            : "Paste magnet link here..."
        }
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
        {isDirectUrl ? (
          <>
            <button
              className="settings-save-btn"
              disabled={streamProcessing}
              onClick={handleInternalStream}
              style={actionButtonStyle}
            >
              {streamProcessing ? "Opening Stream..." : "Stream"}
            </button>

            <button
              className="settings-default-btn"
              disabled={externalProcessing}
              onClick={handleExternalStream}
              style={actionButtonStyle}
            >
              {externalProcessing ? "Opening External..." : "Stream Externally"}
            </button>
          </>
        ) : (
          <>
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
              disabled={externalProcessing}
              onClick={handleExternalStream}
              style={actionButtonStyle}
            >
              {externalProcessing ? "Opening Stream..." : "Stream Externally"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
