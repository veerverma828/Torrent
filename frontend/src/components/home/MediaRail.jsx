import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import PosterCard from "../cards/PosterCard.jsx";

// No entry animation: staggered reveals (0.04s x item count) made long rails
// take over a second to finish appearing and cost main-thread time on TV.

const MediaRail = memo(function MediaRail({ title, items, type, keyPrefix, renderItem }) {
  const scrollerRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateScrollState();
  }, [items, updateScrollState]);

  const scrollBy = (direction) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  };

  if (!items?.length) return null;

  return (
    <div className="media-rail-section">
      <h2 className="section-title">{title}</h2>

      <div className="media-rail-wrapper">
        {canScrollLeft && (
          <button
            type="button"
            className="rail-scroll-btn rail-scroll-btn-left"
            onClick={() => scrollBy(-1)}
            aria-label={`Scroll ${title} left`}
          >
            <ChevronLeft size={22} />
          </button>
        )}

        <div className="media-rail" ref={scrollerRef} onScroll={updateScrollState}>
          {items.map((item, index) => {
            const itemKey = `${keyPrefix || title}-${item.type || type}-${item.id || item.seriesId || index}`;
            return (
              <div key={itemKey} className="media-rail-item">
                {renderItem ? renderItem(item) : <PosterCard item={item} type={type} />}
              </div>
            );
          })}
        </div>

        {canScrollRight && (
          <button
            type="button"
            className="rail-scroll-btn rail-scroll-btn-right"
            onClick={() => scrollBy(1)}
            aria-label={`Scroll ${title} right`}
          >
            <ChevronRight size={22} />
          </button>
        )}
      </div>
    </div>
  );
});

export default MediaRail;
