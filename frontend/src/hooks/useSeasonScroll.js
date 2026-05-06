import { useRef, useState, useEffect, useCallback } from "react";

export function useSeasonScroll() {
  const seasonBarRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    if (seasonBarRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = seasonBarRef.current;
      setCanScrollLeft(scrollLeft > 0);
      // -1 buffer for rounding issues on high DPI screens
      setCanScrollRight(Math.round(scrollLeft + clientWidth) < scrollWidth - 1);
    }
  }, []);

  useEffect(() => {
    const handleResizeOrUpdate = () => setTimeout(checkScroll, 50);
    handleResizeOrUpdate();
    window.addEventListener("resize", handleResizeOrUpdate);
    return () => window.removeEventListener("resize", handleResizeOrUpdate);
  }, [checkScroll]);

  const scrollSeasons = useCallback((direction) => {
    if (seasonBarRef.current) {
      const scrollAmount = 300;
      seasonBarRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  }, []);

  return {
    seasonBarRef,
    canScrollLeft,
    canScrollRight,
    checkScroll,
    scrollSeasons,
  };
}
