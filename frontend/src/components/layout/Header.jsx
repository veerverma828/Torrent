import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../../context/AppContext.jsx";
import appLogoPng from "../../../Images/title-logo-600.png";
import appLogoWebp from "../../../Images/title-logo-600.webp";

export default function Header() {
  const navigate = useNavigate();
  const { setQuery } = useAppContext();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`sticky top-0 z-30 flex justify-center py-2 transition-colors duration-300 ${
        scrolled ? "bg-bg-elevated/80 backdrop-blur-md shadow-card" : "bg-transparent"
      }`}
    >
      <picture>
        <source srcSet={appLogoWebp} type="image/webp" />
        <img
          src={appLogoPng}
          alt="Torrent Debrid"
          className="w-full max-w-[300px] h-auto object-contain cursor-pointer outline-none"
          width="600"
          height="121"
          decoding="async"
          fetchPriority="high"
          onClick={() => {
            setQuery("");
            navigate("/");
          }}
        />
      </picture>
    </div>
  );
}
