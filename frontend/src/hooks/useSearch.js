import { useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  useCatalogContext,
  useMediaContext,
  useSearchContext,
} from "../context/AppContext.jsx";
import { useSettingsContext } from "../context/SettingsContext.jsx";
import { API_URL } from "../services/api.js";
import {
  searchMovies,
  searchSeries,
  fetchDefaultMovies,
  fetchDefaultSeries,
} from "../services/cinemeta.js";

export function useSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const contentSearchRequestId = useRef(0);
  const contentSearchAbortController = useRef(null);
  const torrentSearchRequestId = useRef(0);
  const torrentSearchAbortController = useRef(null);

  const { query, setQuery, loading, setLoading, results, setResults } =
    useSearchContext();

  const {
    movies,
    setMovies,
    series,
    setSeries,
    defaultMovies,
    setDefaultMovies,
    defaultSeries,
    setDefaultSeries,
    setMoviesLoading,
    setSeriesLoading,
  } = useCatalogContext();

  const {
    setSelectedItem,
    setSeasons,
    setEpisodes,
    setSelectedSeason,
  } = useMediaContext();

  const { autoSearch, useJackett, imdbMode } = useSettingsContext();

  const searchContent = useCallback(async () => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) return;

    const requestId = ++contentSearchRequestId.current;

    contentSearchAbortController.current?.abort();

    const controller = new AbortController();
    contentSearchAbortController.current = controller;

    setLoading(true);
    navigate("/");

    try {
      const [movieList, seriesList] = await Promise.all([
        searchMovies(trimmedQuery, { signal: controller.signal }),
        searchSeries(trimmedQuery, { signal: controller.signal }),
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
      if (err.name !== "AbortError") {
        console.error("Content search failed:", err);
      }
    } finally {
      if (requestId === contentSearchRequestId.current) {
        setLoading(false);
      }
    }
  }, [query, navigate, setLoading, setMovies, setSeries, setSelectedItem, setResults]);

  const searchTorrents = useCallback(async () => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) return;

    const requestId = ++torrentSearchRequestId.current;

    torrentSearchAbortController.current?.abort();

    const controller = new AbortController();
    torrentSearchAbortController.current = controller;

    setLoading(true);

    if (imdbMode && !useJackett && !trimmedQuery.startsWith("tt")) {
      console.error("Invalid IMDb ID entered");
      setLoading(false);
      return;
    }

    if (imdbMode && !useJackett) {
      setLoading(false);
      navigate(`/movie/${trimmedQuery}`);
      return;
    }

    try {
      const encodedQuery = encodeURIComponent(trimmedQuery);
      const res = await fetch(`${API_URL}/search?q=${encodedQuery}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Search failed with status ${res.status}`);
      }

      const data = await res.json();

      if (requestId !== torrentSearchRequestId.current) {
        return;
      }

      setResults(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Torrent search failed:", err);
        setResults([]);
      }
    } finally {
      if (requestId === torrentSearchRequestId.current) {
        setLoading(false);
      }
    }
  }, [query, imdbMode, useJackett, navigate, setLoading, setResults]);

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

  const hasFetchedCatalog = useRef(false);

  useEffect(() => {
    if (hasFetchedCatalog.current) return;

    hasFetchedCatalog.current = true;

    fetchDefaultMovies()
      .then((data) => {
        setDefaultMovies(data);
        setMovies(data);
      })
      .catch((err) => console.error("Error fetching default movie catalog:", err))
      .finally(() => setMoviesLoading(false));

    fetchDefaultSeries()
      .then((data) => {
        setDefaultSeries(data);
        setSeries(data);
      })
      .catch((err) => console.error("Error fetching default series catalog:", err))
      .finally(() => setSeriesLoading(false));
  }, [setDefaultMovies, setDefaultSeries, setMovies, setSeries, setMoviesLoading, setSeriesLoading]);

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
