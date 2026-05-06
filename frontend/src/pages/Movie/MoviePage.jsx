import { useEffect, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useAppContext } from "../../context/AppContext.jsx";
import { useSettingsContext } from "../../context/SettingsContext.jsx";
import { useStreamActions } from "../../hooks/useStreamActions.js";
import { fetchMovieStreams } from "../../services/cinemeta.js";
import Loader from "../../components/common/Loader.jsx";
import ResultCard from "../../components/cards/ResultCard.jsx";
import "./MoviePage.css";

export default function MoviePage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const { setSelectedItem, setResults, setLoading, loading, results } = useAppContext();
  const { addonApis } = useSettingsContext();
  const { initAction } = useStreamActions();

  // Use ref to avoid stale closure for initAction in effect
  const initActionRef = useRef(initAction);
  initActionRef.current = initAction;

  useEffect(() => {
    const stateItem = location.state?.item;
    const autoPlayMagnet = location.state?.autoPlayMagnet;

    setSelectedItem(stateItem || { id, name: "Movie", type: "movie" });

    if (autoPlayMagnet) {
      navigate(location.pathname, {
        state: { ...location.state, autoPlayMagnet: null },
        replace: true,
      });
      initActionRef.current(autoPlayMagnet, "stream", true);
    }

    setLoading(true);
    fetchMovieStreams(id, addonApis)
      .then((streams) => {
        setResults(streams);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, addonApis, location.pathname]);

  return (
    <div className="results-container">
      {loading && <Loader />}
      {results.map((item, index) => (
        <ResultCard key={index} item={item} index={index} />
      ))}
    </div>
  );
}
