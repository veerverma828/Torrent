import { lazy, Suspense, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "../context/AppContext.jsx";
import { usePlayerContext } from "../context/PlayerContext.jsx";
import { useSettingsContext } from "../context/SettingsContext.jsx";
import { useKeyboardNavigation } from "../hooks/useKeyboardNavigation.js";
import { useDebrid } from "../hooks/useDebrid.js";
import SettingsButton from "../components/layout/SettingsButton.jsx";
import Header from "../components/layout/Header.jsx";
import SearchBar from "../components/layout/SearchBar.jsx";
import "../styles/globals.css";
import "../styles/animations.css";
import "../components/modals/SettingsModal.css";

const VideoPlayer = lazy(() => import("../components/player/VideoPlayer.jsx"));
const SettingsModal = lazy(() => import("../components/modals/SettingsModal.jsx"));

export default function Layout() {
  const location = useLocation();

  const { results, seasons, episodes, selectedSeason } = useAppContext();
  const { streamUrl, fileModalData, setFileModalData, setStreamUrl } = usePlayerContext();
  const { isSettingsOpen } = useSettingsContext();

  const { debridService, handleDebridChange } = useDebrid();

  useKeyboardNavigation();

  // Keep the lazy modal/player mounted once first triggered so their internal
  // AnimatePresence can play an exit animation instead of being hard-unmounted.
  const [playerEverOpened, setPlayerEverOpened] = useState(false);
  const [settingsEverOpened, setSettingsEverOpened] = useState(false);

  useEffect(() => {
    if (streamUrl) setPlayerEverOpened(true);
  }, [streamUrl]);

  useEffect(() => {
    if (isSettingsOpen) setSettingsEverOpened(true);
  }, [isSettingsOpen]);

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
      let shouldScrollToTop = false;

      const isEpisodeRoute = /\/series\/.*\/season\/\d+\/episode\/\d+/i.test(location.pathname);

      if (fileModalData) {
        target = document.querySelector(".file-item");
      } else if (results.length > 0) {
        target = document.querySelector(".result-btn");

        // Only scroll to top for movie/general stream pages.
        // Keep position while selecting episodes inside series.
        shouldScrollToTop = !isEpisodeRoute;
      } else if (selectedSeason && episodes.length > 0) {
        target = document.querySelector(".episode-card");
      }

      if (target) {
        if (shouldScrollToTop) {
          window.scrollTo({
            top: 0,
            behavior: "auto",
          });
        }

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
  }, [results, seasons, episodes, selectedSeason, fileModalData, location.pathname]);

  // Route-based modal syncing (close modals on back press)
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const modal = searchParams.get("modal");

    if (modal !== "file") setFileModalData(null);
    if (modal !== "stream") setStreamUrl(null);
  }, [location.search, setFileModalData, setStreamUrl]);

  return (
    <div className="app-container min-h-screen bg-bg-base text-text-primary font-sans">
      <SettingsButton />

      <Header />

      {/* Debrid Service Selector */}
      <div className="options-container">
        <div className="inline-flex rounded-full bg-bg-surface p-1 gap-0 text-xs">
          {[
            { value: "real-debrid", label: "Real-Debrid" },
            { value: "torbox", label: "Torbox" },
          ].map((opt) => {
            const isActive = debridService === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleDebridChange(opt.value)}
                className={`relative px-4 py-1.5 rounded-full font-medium transition-colors ${
                  isActive ? "text-white" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {isActive && (
                  <motion.div
                    className="absolute inset-0 rounded-full bg-accent-primary -z-10"
                    layoutId="debrid-pill"
                    transition={{ type: "spring", duration: 0.4, bounce: 0.2 }}
                  />
                )}
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <SearchBar />

      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>

      {playerEverOpened && (
        <Suspense fallback={null}>
          <VideoPlayer />
        </Suspense>
      )}

      {settingsEverOpened && (
        <Suspense fallback={null}>
          <SettingsModal />
        </Suspense>
      )}
    </div>
  );
}
