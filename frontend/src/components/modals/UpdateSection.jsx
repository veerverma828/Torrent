import { Download, Loader2, RefreshCw, CheckCircle2 } from "lucide-react";
import { isNativeApp, openInstallPermissionSettings } from "../../lib/apkUpdater.js";
import { useUpdate } from "../../context/UpdateContext.jsx";

const sectionCardStyle = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "16px",
  padding: "18px",
};

const btn =
  "inline-flex items-center gap-1.5 rounded-lg bg-accent-primary px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-accent-primary-hover transition-colors disabled:opacity-50";
const btnGhost =
  "inline-flex items-center gap-1.5 rounded-lg border border-border-default px-3.5 py-2 text-[13px] font-semibold text-text-primary hover:bg-bg-surface-hover transition-colors";

export default function UpdateSection() {
  const {
    currentBuild,
    update,
    checking,
    checkError,
    phase,
    percent,
    errorMessage,
    checkForUpdate,
    startDownload,
    attemptInstall,
    cancelDownload,
  } = useUpdate();

  return (
    <div className="settings-section" style={sectionCardStyle}>
      <h3 style={{ marginBottom: "16px" }}>App Updates</h3>

      <div className="flex flex-col gap-3 text-[13px] text-text-secondary">
        <div className="flex items-center justify-between">
          <span>Installed build</span>
          <span className="text-text-primary font-mono">
            {currentBuild ? `#${currentBuild}` : "dev"}
          </span>
        </div>

        {!isNativeApp && (
          <p className="text-text-muted">
            In-app updates are only available in the installed Android app.
          </p>
        )}

        {isNativeApp && !update && (
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2">
              {checkError ? (
                "Couldn't check (offline or rate-limited)."
              ) : checking ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-500" /> You're up to date.
                </>
              )}
            </span>
            <button className={btnGhost} onClick={checkForUpdate} disabled={checking}>
              <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} /> Check
            </button>
          </div>
        )}

        {isNativeApp && update && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-text-primary">
                Update available — build #{update.build}
              </span>
            </div>

            {phase === "idle" && (
              <button className={btn} onClick={startDownload}>
                <Download className="h-4 w-4" /> Download &amp; install
              </button>
            )}

            {phase === "downloading" && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-text-primary">
                    <Loader2 className="h-4 w-4 animate-spin" /> Downloading… {percent}%
                  </span>
                  <button className={btnGhost} onClick={cancelDownload}>
                    Cancel
                  </button>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-input">
                  <div
                    className="h-full rounded-full bg-accent-primary transition-[width] duration-200"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            )}

            {phase === "downloaded" && (
              <button className={btn} onClick={attemptInstall}>
                <Download className="h-4 w-4" /> Install now
              </button>
            )}

            {phase === "needs-permission" && (
              <div className="flex flex-col gap-2">
                <p className="text-text-secondary">
                  Allow Torrent Debrid to install apps, then tap Install again.
                </p>
                <div className="flex items-center gap-2">
                  <button className={btn} onClick={openInstallPermissionSettings}>
                    Open settings
                  </button>
                  <button className={btnGhost} onClick={attemptInstall}>
                    Try again
                  </button>
                </div>
              </div>
            )}

            {phase === "error" && (
              <div className="flex items-center justify-between">
                <span className="text-accent-primary">{errorMessage}</span>
                <button className={btnGhost} onClick={startDownload}>
                  Retry
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
