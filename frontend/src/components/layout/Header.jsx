import { useNavigate } from "react-router-dom";
import { useAppContext } from "../../context/AppContext.jsx";
import appLogoPng from "../../../Images/title-logo-600.png";
import appLogoWebp from "../../../Images/title-logo-600.webp";

export default function Header() {
  const navigate = useNavigate();
  const { setQuery } = useAppContext();

  return (
    <div className="logo-container">
      <picture>
        <source srcSet={appLogoWebp} type="image/webp" />
        <img
          src={appLogoPng}
          alt="Torrent Debrid"
          className="app-logo"
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
