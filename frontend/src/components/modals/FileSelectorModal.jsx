import { useNavigate } from "react-router-dom";
import { usePlayerContext } from "../../context/PlayerContext.jsx";
import "./FileSelectorModal.css";
import { useStreamActions } from "../../hooks/useStreamActions.js";
import { formatBytes } from "../../utils/formatBytes.js";

export default function FileSelectorModal({ files, actionType }) {
  const navigate = useNavigate();
  const { processingFile } = usePlayerContext();
  const { selectFileAndExecute } = useStreamActions();

  return (
    <div className="file-dropdown">
      <div className="file-dropdown-header">
        <span>
          Select a file to{" "}
          <strong>
            {actionType.charAt(0).toUpperCase() + actionType.slice(1)}
          </strong>
          :
        </span>
        <button onClick={() => navigate(-1)} title="Close">
          ✖
        </button>
      </div>
      <div className="file-list">
        {files.map((f) => (
          <div
            key={f.id}
            className="file-item"
            tabIndex="0"
            onKeyDown={(e) => {
              if (e.key === "Enter") selectFileAndExecute(f.id);
            }}
            onClick={() => selectFileAndExecute(f.id)}
            style={{
              opacity: processingFile && processingFile !== f.id ? 0.5 : 1,
              pointerEvents: processingFile ? "none" : "auto",
            }}
          >
            <div className="file-name">
              {processingFile === f.id && <span className="loader-small"></span>}
              {f.name.replace(/^\//, "")}
            </div>
            <div className="file-size">{formatBytes(f.size)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
