import { useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAppContext } from "../context/AppContext.jsx";
import { useSettingsContext } from "../context/SettingsContext.jsx";
import { API_URL } from "../services/api.js";
import {
  searchMovies,
  searchSeries,
  fetchDefaultCatalog,
} from "../services/cinemeta.js";

export function useSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const contentSearchRequestId = useRef(0);
  const torrentSearchRequestId = useRef(0);

  const {
    query,
    setQuery,
    loading,
    setLoading,
    movies,
    setMovies,
    series,
    setSeries,
    results,
    setResults,
    selectedItem,
    setSelectedItem,
    seasons,
    setSeasons,
    episodes,
    setEpisodes,
    selectedSeason,
    setSelectedSeason,
    defaultMovies,
    setDefaultMovies,
    defaultSeries,
    setDefaultSeries,
  } = useAppContext();

  const { addonApis, autoSearch, useJackett, imdbMode } = useSettingsContext();

  const searchContent = useCallback(async () => {
    if (!query.trim()) return;

    const requestId = ++contentSearchRequestId.current;

    setLoading(true);
    navigate("/");

    try {
      const [movieList, seriesList] = await Promise.all([
        searchMovies(query),
        searchSeries(query),
      ]);

      if (requestId !== contentSearchRequestId.current) {
        return;
      }

      const combined = [...movieList, ...seriesList];
      const movieListFiltered = combined.filter((item) => item.type === "movie");
      const seriesListFiltered = combined.filter((item) => item.type === "series");

      setMovies(movieListFiltered);
      setSeries(seriesListFiltered);
      setSelectedItem(null);
      setResults([]);
    } catch (err) {
      console.error(err);
    }

    if (requestId === contentSearchRequestId.current) {
      setLoading(false);
    }
  }, [query, navigate, setLoading, setMovies, setSeries, setSelectedItem, setResults]);

  const searchTorrents = useCallback(async () => {
    if (!query.trim()) return;

    const requestId = ++torrentSearchRequestId.current;

    setLoading(true);

    if (imdbMode && !useJackett && !query.startsWith("tt")) {
      setLoading(false);
      alert("Please enter a valid IMDb ID (e.g. tt10872600)");
      return;
    }
    if (imdbMode && !useJackett) {
      setLoading(false);
      navigate(`/movie/${query.trim()}`);
      return;
    }

    try {
      const encodedQuery = encodeURIComponent(query.trim());
      const res = await fetch(`${API_URL}/search?q=${encodedQuery}`);
      const data = await res.json();

      if (requestId !== torrentSearchRequestId.current) {
        return;
      }

      setResults(data);
    } catch (err) {
      console.error("Error:", err);
      alert("Something went wrong");
    }

    if (requestId === torrentSearchRequestId.current) {
      setLoading(false);
    }
  }, [query, imdbMode, useJackett, navigate, setLoading, setResults]);

  // Auto-search debounce
  useEffect(() => {
    if (!autoSearch) return;

    const delay = setTimeout(() => {
      if (query.trim() !== "") {
        if (useJackett || imdbMode) {
          searchTorrents();
        } else {
          searchContent();
        }
      }
    }, 400);

    return () => clearTimeout(delay);
  }, [query, autoSearch, useJackett, imdbMode, searchContent, searchTorrents]);

  // Restore defaults when query is cleared
  useEffect(() => {
    if (query.trim() === "") {
      setMovies(defaultMovies);
      setSeries(defaultSeries);
      if (location.pathname === "/") {
        setResults([]);
        setSelectedItem(null);
        setSelectedSeason(null);
        setSeasons([]);
        setEpisodes([]);
      }
    }
  }, [query, defaultMovies, defaultSeries, location.pathname, setMovies, setSeries, setResults, setSelectedItem, setSelectedSeason, setSeasons, setEpisodes]);

  // Fetch default catalog on mount (once only)
  const hasFetchedCatalog = useRef(false);
  useEffect(() => {
    if (hasFetchedCatalog.current) return;
    hasFetchedCatalog.current = true;
    const fetchCatalog = async () => {
      try {
        const { movies: movieCatalog, series: seriesCatalog } = await fetchDefaultCatalog();
        setDefaultMovies(movieCatalog);
        setDefaultSeries(seriesCatalog);
        setMovies(movieCatalog);
        setSeries(seriesCatalog);
      } catch (err) {
        console.error("Error fetching catalog:", err);
      }
    };
    fetchCatalog();
  }, [setDefaultMovies, setDefaultSeries, setMovies, setSeries]);

  return {
    query,
    setQuery,
    loading,
    movies,
    series,
    results,
    searchContent,
    searchTorrents,
  };
}
