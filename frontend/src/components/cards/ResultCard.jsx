import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { useSettingsContext } from "../../context/SettingsContext.jsx";
import { usePlayerContext } from "../../context/PlayerContext.jsx";
import { useStreamActions } from "../../hooks/useStreamActions.js";
import { formatBytes } from "../../utils/formatBytes.js";
import FileSelectorModal from "../modals/FileSelectorModal.jsx";

function ResultCard({ item, index }) {
  const navigate = useNavigate();
  const { useJackett, debridService } = useSettingsContext();
  const { processingMagnet, fileModalData } = usePlayerContext();
  const { initAction, copyMagnet } = useStreamActions();

  const isDirect = item.magnet && item.magnet.startsWith("http");
  const isProcessing = processingMagnet === item.magnet;
  const isFileModalOpen = fileModalData && fileModalData.magnet === item.magnet && !isDirect;

  return (
    <div className="result-item">
      <h3 className="result-title">{item.title}</h3>
      <p>Source: {item.provider}</p>

      {useJackett && (
        <>
          <p>Size: {Math.round(item.size / 1000000)} MB</p>
          <p>Seeders: {item.seeders}</p>
        </>
      )}

      <div className="button-container">
        <button
          className="action-button"
          onClick={() => initAction(item.magnet, "download")}
          disabled={isProcessing}
          style={{
            background: isProcessing ? "#6c757d" : "#007BFF",
            cursor: isProcessing ? "not-allowed" : "pointer",
          }}
        >
          {isProcessing ? (
            <>
              <span className="loader-small"></span> Processing...
            </>
          ) : isDirect ? (
            "⬇ Direct Download"
          ) : (
            `Download (${debridService === "torbox" ? "Torbox" : "RD"})`
          )}
        </button>

        <button
          className="action-button"
          onClick={() => copyMagnet(item.magnet)}
          style={{
            background: "#6c757d",
            cursor: "pointer",
          }}
        >
          Copy {isDirect ? "Link" : "Magnet"}
        </button>

        {/* Stream Button Group */}
        <div className="split-btn-group push-right">
          <button
            className={`result-btn action-button ${!isDirect ? "split-btn-main" : ""}`}
            onClick={() => initAction(item.magnet, "stream", true)}
            disabled={isProcessing}
            style={{
              background: isProcessing ? "#6c757d" : "#1e7e34",
              cursor: isProcessing ? "not-allowed" : "pointer",
            }}
            title={isDirect ? "Instantly stream video" : "Instantly stream the main video file"}
          >
            {isProcessing ? (
              <>
                <span className="loader-small"></span> Loading...
              </>
            ) : (
              "▶ Stream"
            )}
          </button>
          {!isDirect && (
            <button
              className="action-button split-btn-arrow"
              onClick={() => initAction(item.magnet, "stream", false)}
              disabled={isProcessing}
              style={{
                background: isProcessing ? "#6c757d" : "#1e7e34",
                cursor: isProcessing ? "not-allowed" : "pointer",
              }}
              title="Choose a specific file to stream"
            >
              ▼
            </button>
          )}
        </div>

        {/* External Stream Button */}
        <div className="split-btn-group">
          <button
            className={`result-btn action-button ${!isDirect ? "split-btn-main" : ""}`}
            onClick={() => initAction(item.magnet, "external", true)}
            disabled={isProcessing}
            style={{
              background: isProcessing ? "#6c757d" : "#6f42c1",
              cursor: isProcessing ? "not-allowed" : "pointer",
            }}
            title={
              isDirect
                ? "Instantly play in an external player"
                : "Instantly play the main video file in an external player"
            }
          >
            {isProcessing ? (
              <>
                <span className="loader-small"></span> Loading...
              </>
            ) : (
              "▶ External"
            )}
          </button>
          {!isDirect && (
            <button
              className="action-button split-btn-arrow"
              onClick={() => initAction(item.magnet, "external", false)}
              disabled={isProcessing}
              style={{
                background: isProcessing ? "#6c757d" : "#6f42c1",
                cursor: isProcessing ? "not-allowed" : "pointer",
              }}
              title="Choose a specific file to play externally"
            >
              ▼
            </button>
          )}
        </div>
      </div>

      {isFileModalOpen && (
        <FileSelectorModal
          files={fileModalData.files}
          actionType={fileModalData.actionType}
        />
      )}
    </div>
  );
}

export default memo(ResultCard);
