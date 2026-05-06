import { useEffect } from "react";

export function useKeyboardNavigation() {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) {
        const activeEl = document.activeElement;

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

        e.preventDefault(); // Prevent page scrolling with arrows

        // Find all visible, focusable elements on the screen
        const focusable = Array.from(
          document.querySelectorAll('button, input, [tabindex="0"]')
        ).filter((el) => !el.disabled && (el.offsetWidth > 0 || el.offsetHeight > 0));

        const currentIndex = focusable.indexOf(activeEl);

        if (currentIndex === -1) {
          // Smart Fallback: if focus is lost, jump to the most relevant content
          const defaultTarget =
            document.querySelector(".result-btn") ||
            document.querySelector(".episode-card") ||
            document.querySelector(".season-tab") ||
            document.querySelector(".poster-card") ||
            focusable[0];
          if (defaultTarget) {
            defaultTarget.focus({ preventScroll: true });
            defaultTarget.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          return;
        }

        let targetElement = null;

        if (e.key === "ArrowRight") {
          targetElement = focusable[(currentIndex + 1) % focusable.length];
        } else if (e.key === "ArrowLeft") {
          targetElement = focusable[(currentIndex - 1 + focusable.length) % focusable.length];
        } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          // Visual/Geometric navigation for Up/Down
          const currentRect = activeEl.getBoundingClientRect();
          const currentCenterX = currentRect.left + currentRect.width / 2;

          let bestMatch = null;
          let minDistance = Infinity;

          focusable.forEach((el) => {
            if (el === activeEl) return;
            const rect = el.getBoundingClientRect();
            let isValidCandidate = false;
            let dy = 0;

            // Check if the element is physically below/above (with 10px margin of error)
            if (e.key === "ArrowDown" && rect.top >= currentRect.bottom - 10) {
              isValidCandidate = true;
              dy = rect.top - currentRect.bottom;
            } else if (e.key === "ArrowUp" && rect.bottom <= currentRect.top + 10) {
              isValidCandidate = true;
              dy = currentRect.top - rect.bottom;
            }

            if (isValidCandidate) {
              const targetCenterX = rect.left + rect.width / 2;
              const dx = Math.abs(currentCenterX - targetCenterX);

              // Multiply vertical distance by 10 to heavily prioritize the immediate next row
              const distance = dy * 10 + dx;

              if (distance < minDistance) {
                minDistance = distance;
                bestMatch = el;
              }
            }
          });

          targetElement = bestMatch;
        }

        // TV-Style Smooth Centered Scrolling
        if (targetElement) {
          targetElement.focus({ preventScroll: true });
          targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
