import { useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAppContext } from "../context/AppContext.jsx";
import { usePlayerContext } from "../context/PlayerContext.jsx";
import { useSettingsContext } from "../context/SettingsContext.jsx";
import { useKeyboardNavigation } from "../hooks/useKeyboardNavigation.js";
import { useDebrid } from "../hooks/useDebrid.js";
import SettingsButton from "../components/layout/SettingsButton.jsx";
import Header from "../components/layout/Header.jsx";
import SearchBar from "../components/layout/SearchBar.jsx";
import VideoPlayer from "../components/player/VideoPlayer.jsx";
import SettingsModal from "../components/modals/SettingsModal.jsx";
import "../styles/globals.css";
import "../styles/animations.css";
import "../pages/Player/PlayerPage.css";
import "../components/modals/SettingsModal.css";

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();

  const { results, seasons, episodes, selectedSeason } = useAppContext();
  const { streamUrl, fileModalData, setFileModalData, setStreamUrl } = usePlayerContext();
  const { isSettingsOpen } = useSettingsContext();

  const { debridService, handleDebridChange, rdUnlocked } = useDebrid();

  useKeyboardNavigation();

  // Auto-focus newly loaded content for seamless keyboard navigation
  useEffect(() => {
    let attempts = 0;
    let timeoutId;

    const tryFocus = () => {
      const activeEl = document.activeElement;
      if (activeEl && activeEl.tagName === "INPUT" && activeEl.type === "text") {
        return;
      }

      let target = null;
      if (fileModalData) {
        target = document.querySelector(".file-item");
      } else if (results.length > 0) {
        target = document.querySelector(".result-btn");
      } else if (selectedSeason && episodes.length > 0) {
        target = document.querySelector(".episode-card");
      }

      if (target) {
        window.scrollTo({
          top: 0,
          behavior: "auto",
        });

        requestAnimationFrame(() => {
          target.focus({ preventScroll: true });
        });
      } else if (attempts < 5) {
        attempts++;
        timeoutId = setTimeout(tryFocus, 100);
      }
    };

    timeoutId = setTimeout(tryFocus, 50);
    return () => clearTimeout(timeoutId);
  }, [results, seasons, episodes, selectedSeason, fileModalData]);

  // Route-based modal syncing (close modals on back press)
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const modal = searchParams.get("modal");
    if (modal !== "file") setFileModalData(null);
    if (modal !== "stream") setStreamUrl(null);
  }, [location.search, setFileModalData, setStreamUrl]);

  return (
    <div className="app-container">
      <SettingsButton />

      <Header />

      {/* Debrid Service Selector */}
      <div className="options-container">
        <div className="debrid-selector">
          <label className="radio-label">
            <input
              type="radio"
              name="debrid"
              value="real-debrid"
              checked={debridService === "real-debrid"}
              onChange={() => handleDebridChange("real-debrid")}
            />
            {" "}Real-Debrid
          </label>
          <label className="radio-label">
            <input
              type="radio"
              name="debrid"
              value="torbox"
              checked={debridService === "torbox"}
              onChange={() => handleDebridChange("torbox")}
            />
            {" "}Torbox
          </label>
        </div>
      </div>

      <SearchBar />

      <Outlet />

      {streamUrl && <VideoPlayer />}

      {isSettingsOpen && <SettingsModal />}
    </div>
  );
}
