import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Play, Info, Star } from "lucide-react";
import { useAppContext } from "../../context/AppContext.jsx";

const HERO_POOL_SIZE = 5;

function pickHeroItem(movies, series) {
  const candidates = [...movies, ...series]
    .filter((item) => item.background && item.description)
    .sort((a, b) => (Number(b.imdbRating) || 0) - (Number(a.imdbRating) || 0))
    .slice(0, HERO_POOL_SIZE);

  if (candidates.length === 0) return null;

  return candidates[Math.floor(Math.random() * candidates.length)];
}

export default function HeroBanner() {
  const navigate = useNavigate();
  const { movies, series, moviesLoading, seriesLoading } = useAppContext();

  const hero = useMemo(
    () => pickHeroItem(movies, series),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [movies.length, series.length]
  );

  if (moviesLoading && seriesLoading) {
    return <div className="hero-banner hero-banner-skeleton" aria-hidden="true" />;
  }

  if (!hero) return null;

  const goToDetail = () => {
    navigate(`/${hero.type}/${hero.id}`, { state: { item: hero } });
  };

  return (
    <motion.div
      className="hero-banner"
      style={{ backgroundImage: `url(${hero.background})` }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
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
  );
}
