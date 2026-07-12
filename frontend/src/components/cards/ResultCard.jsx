import { lazy, memo, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { HardDrive, Users, Server, Play, ChevronDown } from "lucide-react";
import { useSettingsContext } from "../../context/SettingsContext.jsx";
import { usePlayerContext } from "../../context/PlayerContext.jsx";
import { useStreamActions } from "../../hooks/useStreamActions.js";

const FileSelectorModal = lazy(() => import("../modals/FileSelectorModal.jsx"));

function ResultCard({ item, index }) {
  const navigate = useNavigate();
  const { useJackett, debridService } = useSettingsContext();
  const { processingMagnet, fileModalData } = usePlayerContext();
  const { initAction, copyMagnet } = useStreamActions();

  const isDirect = item.magnet && item.magnet.startsWith("http");
  const isProcessing = processingMagnet === item.magnet;
  const isFileModalOpen = fileModalData && fileModalData.magnet === item.magnet && !isDirect;

  return (
    <div className="rounded-lg bg-bg-surface border border-border-subtle p-4 mt-2.5 hover:border-border-strong transition-colors">
      <h3 className="result-title text-text-primary font-semibold text-base mb-1 break-words">
        {item.title}
      </h3>

      <div className="flex flex-wrap gap-3 mb-2 text-xs text-text-secondary">
        <span className="inline-flex items-center gap-1">
          <Server size={13} /> {item.provider}
        </span>
        {useJackett && (
          <>
            <span className="inline-flex items-center gap-1">
              <HardDrive size={13} /> {Math.round(item.size / 1000000)} MB
            </span>
            <span className="inline-flex items-center gap-1">
              <Users size={13} /> {item.seeders}
            </span>
          </>
        )}
      </div>

      <div className="button-container">
        <button
          className="action-button"
          onClick={() => initAction(item.magnet, "download")}
          disabled={isProcessing}
          style={{
            background: isProcessing ? "#3f3f46" : "#007BFF",
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
            background: "#3f3f46",
            cursor: "pointer",
          }}
        >
          Copy {isDirect ? "Link" : "Magnet"}
        </button>

        {/* Stream Button Group */}
        <div className="split-btn-group push-right">
          <button
            className={`result-btn action-button ${!isDirect ? "split-btn-main" : ""} inline-flex items-center justify-center gap-1.5`}
            onClick={() => initAction(item.magnet, "stream", true)}
            disabled={isProcessing}
            style={{
              background: isProcessing ? "#3f3f46" : "#1db954",
              cursor: isProcessing ? "not-allowed" : "pointer",
            }}
            title={isDirect ? "Instantly stream video" : "Instantly stream the main video file"}
          >
            {isProcessing ? (
              <>
                <span className="loader-small"></span> Loading...
              </>
            ) : (
              <>
                <Play size={14} fill="currentColor" /> Stream
              </>
            )}
          </button>
          {!isDirect && (
            <button
              className="action-button split-btn-arrow flex items-center justify-center"
              onClick={() => initAction(item.magnet, "stream", false)}
              disabled={isProcessing}
              style={{
                background: isProcessing ? "#3f3f46" : "#1db954",
                cursor: isProcessing ? "not-allowed" : "pointer",
              }}
              title="Choose a specific file to stream"
            >
              <ChevronDown size={16} />
            </button>
          )}
        </div>

        {/* External Stream Button */}
        <div className="split-btn-group">
          <button
            className={`result-btn action-button ${!isDirect ? "split-btn-main" : ""} inline-flex items-center justify-center gap-1.5`}
            onClick={() => initAction(item.magnet, "external", true)}
            disabled={isProcessing}
            style={{
              background: isProcessing ? "#3f3f46" : "#8b5cf6",
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
              <>
                <Play size={14} fill="currentColor" /> External
              </>
            )}
          </button>
          {!isDirect && (
            <button
              className="action-button split-btn-arrow flex items-center justify-center"
              onClick={() => initAction(item.magnet, "external", false)}
              disabled={isProcessing}
              style={{
                background: isProcessing ? "#3f3f46" : "#8b5cf6",
                cursor: isProcessing ? "not-allowed" : "pointer",
              }}
              title="Choose a specific file to play externally"
            >
              <ChevronDown size={16} />
            </button>
          )}
        </div>
      </div>

      {isFileModalOpen && (
        <Suspense fallback={null}>
          <FileSelectorModal
            files={fileModalData.files}
            actionType={fileModalData.actionType}
          />
        </Suspense>
      )}
    </div>
  );
}

export default memo(ResultCard);
