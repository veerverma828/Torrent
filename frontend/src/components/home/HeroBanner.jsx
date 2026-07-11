import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Play, Info, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { useAppContext } from "../../context/AppContext.jsx";

const HERO_POOL_SIZE = 5;
const AUTO_ADVANCE_MS = 8000;
const SWIPE_THRESHOLD = 80;

function pickHeroCandidates(movies, series) {
  return [...movies, ...series]
    .filter((item) => item.background && item.description)
    .sort((a, b) => (Number(b.imdbRating) || 0) - (Number(a.imdbRating) || 0))
    .slice(0, HERO_POOL_SIZE);
}

export default function HeroBanner() {
  const navigate = useNavigate();
  const { movies, series, moviesLoading, seriesLoading } = useAppContext();

  const candidates = useMemo(
    () => pickHeroCandidates(movies, series),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [movies.length, series.length]
  );

  const [index, setIndex] = useState(0);
  const timerRef = useRef(null);

  const count = candidates.length;
  const hero = count > 0 ? candidates[index % count] : null;

  const goNext = () => setIndex((i) => (i + 1) % count);
  const goPrev = () => setIndex((i) => (i - 1 + count) % count);

  // Reset to a valid slide whenever the candidate pool changes size.
  useEffect(() => {
    setIndex(0);
  }, [count]);

  // Auto-advance, restarting the countdown after any manual navigation.
  useEffect(() => {
    if (count <= 1) return;

    timerRef.current = setInterval(goNext, AUTO_ADVANCE_MS);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, index]);

  if (moviesLoading && seriesLoading) {
    return <div className="hero-banner hero-banner-skeleton" aria-hidden="true" />;
  }

  if (!hero) return null;

  const goToDetail = () => {
    navigate(`/${hero.type}/${hero.id}`, { state: { item: hero } });
  };

  const handleDragEnd = (_event, info) => {
    if (info.offset.x < -SWIPE_THRESHOLD) goNext();
    else if (info.offset.x > SWIPE_THRESHOLD) goPrev();
  };

  return (
    <div className="hero-banner-viewport">
      <motion.div
        key={hero.id}
        className="hero-banner"
        style={{ backgroundImage: `url(${hero.background})`, touchAction: "pan-y" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        drag={count > 1 ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.15}
        onDragEnd={handleDragEnd}
      >
        <div className="hero-banner-overlay">
          <div className="hero-banner-content">
            <h1 className="hero-banner-title">{hero.name}</h1>

            <div className="media-meta-badges">
              {hero.imdbRating && (
                <span className="meta-badge rating">
                  <Star size={12} fill="currentColor" /> {hero.imdbRating}
                </span>
              )}
              {(hero.releaseInfo || hero.year) && (
                <span className="meta-badge">{hero.releaseInfo || hero.year}</span>
              )}
              {hero.genres?.slice(0, 3).map((g) => (
                <span key={g} className="meta-badge genre">
                  {g}
                </span>
              ))}
            </div>

            <p className="hero-banner-description">{hero.description}</p>

            <div className="hero-banner-actions">
              <button className="hero-btn hero-btn-play" onClick={goToDetail}>
                <Play size={18} fill="currentColor" /> Play
              </button>
              <button className="hero-btn hero-btn-info" onClick={goToDetail}>
                <Info size={18} /> More Info
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {count > 1 && (
        <>
          <button
            type="button"
            className="hero-nav-btn hero-nav-btn-left"
            onClick={goPrev}
            aria-label="Previous featured title"
          >
            <ChevronLeft size={26} />
          </button>
          <button
            type="button"
            className="hero-nav-btn hero-nav-btn-right"
            onClick={goNext}
            aria-label="Next featured title"
          >
            <ChevronRight size={26} />
          </button>

          <div className="hero-dots">
            {candidates.map((item, i) => (
              <button
                key={item.id}
                type="button"
                className={`hero-dot${i === index ? " active" : ""}`}
                onClick={() => setIndex(i)}
                aria-label={`Show featured title ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
