import { useAppContext } from "../../context/AppContext.jsx";
import { useSettingsContext } from "../../context/SettingsContext.jsx";
import { useSearch } from "../../hooks/useSearch.js";

export default function SearchBar() {
  const { query, setQuery } = useAppContext();
  const { imdbMode, useJackett, autoSearch } = useSettingsContext();
  const { searchContent, searchTorrents } = useSearch();

  const placeholder = imdbMode
    ? "Enter IMDb ID (e.g. tt10872600)"
    : useJackett
      ? "Search torrents..."
      : "Search movies or series...";

  const handleKeyDown = (e) => {
    if (!autoSearch && e.key === "Enter") {
      useJackett || imdbMode ? searchTorrents() : searchContent();
    }
  };

  const hasQuery = query.trim().length > 0;

  return (
    <div className="search-container">
      <input
        type="text"
        id="search-input"
        name="search"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        className="search-input"
      />

      <button
        className="search-button"
        style={{
          backgroundColor: hasQuery ? "#007BFF" : "#444",
          cursor: hasQuery ? "pointer" : "not-allowed",
          boxShadow: hasQuery ? "0 4px 15px rgba(0, 123, 255, 0.4)" : "none",
        }}
        onClick={useJackett || imdbMode ? searchTorrents : searchContent}
        disabled={!hasQuery}
      >
        Search
      </button>
    </div>
  );
}
