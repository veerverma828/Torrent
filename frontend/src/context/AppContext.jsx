import { createContext, useContext, useMemo, useState } from "react";

const SearchContext = createContext(null);
const CatalogContext = createContext(null);
const MediaContext = createContext(null);

export function AppProvider({ children }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const [movies, setMovies] = useState([]);
  const [series, setSeries] = useState([]);
  const [defaultMovies, setDefaultMovies] = useState([]);
  const [defaultSeries, setDefaultSeries] = useState([]);
  const [moviesLoading, setMoviesLoading] = useState(true);
  const [seriesLoading, setSeriesLoading] = useState(true);

  const [selectedItem, setSelectedItem] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);

  const searchValue = useMemo(
    () => ({
      query,
      setQuery,
      results,
      setResults,
      loading,
      setLoading,
    }),
    [query, results, loading]
  );

  const catalogValue = useMemo(
    () => ({
      movies,
      setMovies,
      series,
      setSeries,
      defaultMovies,
      setDefaultMovies,
      defaultSeries,
      setDefaultSeries,
      moviesLoading,
      setMoviesLoading,
      seriesLoading,
      setSeriesLoading,
    }),
    [movies, series, defaultMovies, defaultSeries, moviesLoading, seriesLoading]
  );

  const mediaValue = useMemo(
    () => ({
      selectedItem,
      setSelectedItem,
      seasons,
      setSeasons,
      episodes,
      setEpisodes,
      selectedSeason,
      setSelectedSeason,
    }),
    [selectedItem, seasons, episodes, selectedSeason]
  );

  return (
    <SearchContext.Provider value={searchValue}>
      <CatalogContext.Provider value={catalogValue}>
        <MediaContext.Provider value={mediaValue}>{children}</MediaContext.Provider>
      </CatalogContext.Provider>
    </SearchContext.Provider>
  );
}

export function useSearchContext() {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error("useSearchContext must be used within AppProvider");
  return ctx;
}

export function useCatalogContext() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error("useCatalogContext must be used within AppProvider");
  return ctx;
}

export function useMediaContext() {
  const ctx = useContext(MediaContext);
  if (!ctx) throw new Error("useMediaContext must be used within AppProvider");
  return ctx;
}

export function useAppContext() {
  return {
    ...useSearchContext(),
    ...useCatalogContext(),
    ...useMediaContext(),
  };
}
