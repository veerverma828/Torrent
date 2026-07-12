import { useEffect } from "react";

const ARROW_KEYS = ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"];

export function useKeyboardNavigation() {
  useEffect(() => {
    // Track the last meaningfully-focused element so that when focus is lost
    // (e.g. the focused node was unmounted by a re-render) the next arrow key
    // resumes from where the user was, instead of teleporting elsewhere.
    let lastFocused = null;
    const rememberFocus = (e) => {
      const t = e.target;
      if (t instanceof HTMLElement && t !== document.body) lastFocused = t;
    };
    document.addEventListener("focusin", rememberFocus);

    const isVisible = (el) =>
      (el.offsetWidth > 0 || el.offsetHeight > 0) &&
      !el.disabled &&
      el.getAttribute("aria-hidden") !== "true" &&
      getComputedStyle(el).visibility !== "hidden";

    // Cache the focusable-node scan across keydowns — recomputing it via a
    // full document query + getComputedStyle per node on every arrow press
    // caused visible jank on pages with many rails/cards. Invalidated by a
    // MutationObserver whenever the DOM actually changes (rail data loads,
    // route changes, modals open/close), not on a timer.
    let focusableCache = null;
    const invalidateFocusableCache = () => {
      focusableCache = null;
    };
    const domObserver = new MutationObserver(invalidateFocusableCache);
    domObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "disabled", "aria-hidden", "tabindex"] });

    // When a modal/dialog is open, [data-modal-trap] marks its container.
    // All navigation must stay inside it until it closes.
    const getTrapContainer = () => {
      const containers = document.querySelectorAll('[data-modal-trap="true"]');
      for (let i = containers.length - 1; i >= 0; i--) {
        if (isVisible(containers[i])) return containers[i];
      }
      return null;
    };

    const queryFocusable = (root) =>
      Array.from(root.querySelectorAll('button, input, [tabindex="0"]')).filter(isVisible);

    const getFocusable = () => {
      const trap = getTrapContainer();
      if (trap) return queryFocusable(trap);
      if (!focusableCache) focusableCache = queryFocusable(document.body);
      return focusableCache;
    };

    // Nearest ancestor that represents one carousel/rail's horizontal track.
    const getRail = (el) => el.closest(".media-rail");

    const scrollIntoViewSmart = (el, insideRail) => {
      if (insideRail) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      } else {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      }
    };

    // Generic directional nearest-neighbor search: scores candidates that lie
    // in the given direction by primary-axis distance (heavily weighted) plus
    // secondary-axis offset, so movement follows the actual visual layout.
    const findDirectionalMatch = (key, activeEl, candidates) => {
      const currentRect = activeEl.getBoundingClientRect();
      const currentCenterX = currentRect.left + currentRect.width / 2;
      const currentCenterY = currentRect.top + currentRect.height / 2;

      let bestMatch = null;
      let minDistance = Infinity;

      candidates.forEach((el) => {
        if (el === activeEl) return;
        const rect = el.getBoundingClientRect();
        let isValid = false;
        let primary = 0;
        let secondary = 0;

        if (key === "ArrowDown" && rect.top >= currentRect.bottom - 10) {
          isValid = true;
          primary = rect.top - currentRect.bottom;
          secondary = Math.abs(currentCenterX - (rect.left + rect.width / 2));
        } else if (key === "ArrowUp" && rect.bottom <= currentRect.top + 10) {
          isValid = true;
          primary = currentRect.top - rect.bottom;
          secondary = Math.abs(currentCenterX - (rect.left + rect.width / 2));
        } else if (key === "ArrowRight" && rect.left >= currentRect.right - 10) {
          isValid = true;
          primary = rect.left - currentRect.right;
          secondary = Math.abs(currentCenterY - (rect.top + rect.height / 2));
        } else if (key === "ArrowLeft" && rect.right <= currentRect.left + 10) {
          isValid = true;
          primary = currentRect.left - rect.right;
          secondary = Math.abs(currentCenterY - (rect.top + rect.height / 2));
        }

        if (isValid) {
          const distance = primary * 10 + secondary;
          if (distance < minDistance) {
            minDistance = distance;
            bestMatch = el;
          }
        }
      });

      return bestMatch;
    };

    const handleKeyDown = (e) => {
      if (!ARROW_KEYS.includes(e.key)) return;

      let activeEl = document.activeElement;

      // Focus fell back to <body> (element unmounted): restore it first.
      if ((!activeEl || activeEl === document.body) && lastFocused && document.contains(lastFocused) && isVisible(lastFocused)) {
        lastFocused.focus({ preventScroll: true });
        activeEl = lastFocused;
      }

      // Smart Input Navigation
      if (activeEl && activeEl.tagName === "INPUT") {
        if (activeEl.type === "text") {
          // Allow native left/right text navigation inside the search bar
          if (e.key === "ArrowLeft" && activeEl.selectionStart > 0) return;
          if (e.key === "ArrowRight" && activeEl.selectionStart < activeEl.value.length) return;
        } else {
          return; // Radios and Checkboxes keep their default native arrow behavior
        }
      }

      const trap = getTrapContainer();
      if (trap && activeEl && !trap.contains(activeEl)) {
        // Focus somehow escaped the modal (e.g. it just opened) — pull it back in.
        const first = queryFocusable(trap)[0];
        if (first) {
          e.preventDefault();
          first.focus({ preventScroll: true });
        }
        return;
      }

      e.preventDefault(); // Prevent page scrolling with arrows

      const focusable = getFocusable();
      const currentIndex = focusable.indexOf(activeEl);
      const rail = activeEl ? getRail(activeEl) : null;

      if (currentIndex === -1) {
        // Smart Fallback: if focus is lost, jump to the most relevant content
        const scope = trap || document;
        const defaultTarget =
          scope.querySelector(".result-btn") ||
          scope.querySelector(".episode-card") ||
          scope.querySelector(".season-tab") ||
          scope.querySelector(".poster-card") ||
          focusable[0];
        if (defaultTarget) {
          defaultTarget.focus({ preventScroll: true });
          defaultTarget.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }

      let targetElement = null;

      if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && rail) {
        // Inside a carousel: Left/Right cycle through this rail's items only,
        // looping infinitely at either end.
        const railItems = queryFocusable(rail).filter((el) => focusable.includes(el));
        const railIndex = railItems.indexOf(activeEl);
        if (railIndex !== -1 && railItems.length > 0) {
          targetElement =
            e.key === "ArrowRight"
              ? railItems[(railIndex + 1) % railItems.length]
              : railItems[(railIndex - 1 + railItems.length) % railItems.length];
        }
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "ArrowDown" || e.key === "ArrowUp") {
        // Up/Down while inside a rail intentionally falls through here too:
        // same-row rail items never satisfy the above/below test, so this
        // naturally exits the carousel to the nearest element outside it.
        targetElement = findDirectionalMatch(e.key, activeEl, focusable);
      }

      if (targetElement) {
        targetElement.focus({ preventScroll: true });
        scrollIntoViewSmart(targetElement, Boolean(getRail(targetElement)) && (e.key === "ArrowLeft" || e.key === "ArrowRight"));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", rememberFocus);
      domObserver.disconnect();
    };
  }, []);
}
