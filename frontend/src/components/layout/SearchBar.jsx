import { Search, X } from "lucide-react";
import { useSearchContext } from "../../context/AppContext.jsx";
import { useSettingsContext } from "../../context/SettingsContext.jsx";
import { useSearch } from "../../hooks/useSearch.js";

export default function SearchBar() {
  const { query, setQuery } = useSearchContext();
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
    <div className="flex gap-3 justify-center items-center mt-5 flex-wrap px-2">
      <div className="relative w-full max-w-[500px]">
        <Search
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <input
          type="text"
          id="search-input"
          name="search"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full h-[46px] text-base pl-11 pr-11 rounded-full border border-border-strong bg-bg-input text-text-primary outline-none transition-colors duration-300 focus:border-accent-primary"
        />
        {hasQuery && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-7 rounded-full text-text-muted hover:text-text-primary hover:bg-bg-surface-hover transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <button
        className={`h-[46px] w-full max-w-[120px] rounded-full font-bold text-base text-white transition-all duration-300 ${
          hasQuery
            ? "bg-accent-primary hover:bg-accent-primary-hover shadow-[0_4px_15px_rgba(229,9,20,0.4)] cursor-pointer"
            : "bg-bg-surface text-text-disabled cursor-not-allowed"
        }`}
        onClick={useJackett || imdbMode ? searchTorrents : searchContent}
        disabled={!hasQuery}
      >
        Search
      </button>
    </div>
  );
}
