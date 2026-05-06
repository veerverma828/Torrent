import { createContext, useContext, useState } from "react";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [movies, setMovies] = useState([]);
  const [series, setSeries] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);

  const [seasons, setSeasons] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);

  const [loading, setLoading] = useState(false);

  const [defaultMovies, setDefaultMovies] = useState([]);
  const [defaultSeries, setDefaultSeries] = useState([]);

  const [cwTrigger, setCwTrigger] = useState(0);

  const value = {
    query,
    setQuery,
    results,
    setResults,
    movies,
    setMovies,
    series,
    setSeries,
    selectedItem,
    setSelectedItem,
    seasons,
    setSeasons,
    episodes,
    setEpisodes,
    selectedSeason,
    setSelectedSeason,
    loading,
    setLoading,
    defaultMovies,
    setDefaultMovies,
    defaultSeries,
    setDefaultSeries,
    cwTrigger,
    setCwTrigger,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}
