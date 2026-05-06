import { useNavigate } from "react-router-dom";
import { useAppContext } from "../../context/AppContext.jsx";
import appLogo from "../../../Images/TITLE.png";

export default function Header() {
  const navigate = useNavigate();
  const { setQuery } = useAppContext();

  return (
    <div className="logo-container">
      <img
        src={appLogo}
        alt="App Logo"
        className="app-logo"
        onClick={() => {
          setQuery("");
          navigate("/");
        }}
      />
    </div>
  );
}
