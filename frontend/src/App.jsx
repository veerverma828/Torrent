import { useState, useEffect } from "react";

function App() {
  const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [autoSearch, setAutoSearch] = useState(false);
  const [useJackett, setUseJackett] = useState(false);

  const [seasons, setSeasons] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);

  const [loading, setLoading] = useState(false);

  const [imdbMode, setImdbMode] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);

  // ✅ FIX 1: helper function (remove duplication)
  const formatTorrentio = (data) => {
    const streams = data.streams || [];

    return streams.map((stream) => ({
      title: stream.title,
      size: 0,
      seeders: 0,
      magnet: `magnet:?xt=urn:btih:${stream.infoHash}`,
      provider: "Torrentio",
    }));
  };

  const searchContent = async () => {
    if (!query.trim()) return;

    setLoading(true);

    try {
      const res = await fetch(`${API}/search-content?q=${query}`);
      if (!res.ok) throw new Error("Request failed"); // ✅ FIX 3

      const data = await res.json();

      setSearchResults(data);
      setSelectedItem(null);
      setResults([]);

      // ✅ FIX 2
      setSeasons([]);
      setEpisodes([]);
      setSelectedSeason(null);

    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  };

  const searchTorrents = async () => {
    if (!query.trim()) return;

    setLoading(true);

    if (imdbMode && !useJackett && !query.startsWith("tt")) {
      setLoading(false);
      alert("Please enter a valid IMDb ID (e.g. tt10872600)");
      return;
    }

    try {
      if (useJackett) {
        const res = await fetch(`${API}/search?q=${query}`);
        if (!res.ok) throw new Error("Request failed"); // ✅ FIX 3

        const data = await res.json();
        setResults(data);
      } else {
        const url = `https://torrentio.strem.fun/stream/movie/${query}.json`;

        const res = await fetch(url);
        if (!res.ok) throw new Error("Request failed"); // ✅ FIX 3

        const data = await res.json();

        setResults(formatTorrentio(data)); // ✅ FIX 1
      }

      if (imdbMode) {
        setSelectedItem(null);
      }
    } catch (err) {
      console.error("Error:", err);
      alert("Something went wrong");
    }

    setLoading(false);
  };

  const copyMagnet = (magnet) => {
    navigator.clipboard.writeText(magnet);
    alert("Magnet link copied ✅");
  };

  const handleDownload = async (magnet) => {
    const res = await fetch(`${API}/download`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ magnet }),
    });

    const data = await res.json();

    if (data.downloadUrl) {
      window.open(data.downloadUrl);
    } else {
      alert(data.message);
    }
  };

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
    }, 800);

    return () => clearTimeout(delay);
  }, [query, autoSearch, useJackett, imdbMode]);

  return (
    <div style={{ padding: "20px" }}>
      <h1 style={{ textAlign: "center" }}>Debrid Download ⚡</h1>

      {/* UI untouched */}

      {/* ONLY showing modified logic parts below */}

      {!imdbMode && !selectedItem && searchResults.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, 150px)", gap: "15px", marginTop: "20px", justifyContent: "center" }}>
          {searchResults.map((item, i) => (
            <div
              key={i}
              style={{ cursor: "pointer", textAlign: "center" }}
              onClick={async () => {
                setSelectedItem(item);
                setResults([]);
                setSelectedSeason(null);

                if (item.type === "movie") {
                  setLoading(true);

                  const url = `https://torrentio.strem.fun/stream/movie/${item.id}.json`;
                  const res = await fetch(url);
                  if (!res.ok) throw new Error("Request failed");

                  const data = await res.json();

                  setResults(formatTorrentio(data)); // ✅ FIX 1

                  setLoading(false);
                } else {
                  setLoading(true);

                  const res = await fetch(`${API}/series-meta?id=${item.id}`);
                  if (!res.ok) throw new Error("Request failed");

                  const data = await res.json();

                  setSeasons(data.seasons);
                  setEpisodes(data.episodes);

                  setLoading(false);
                }
              }}
            >
              <img src={item.poster} alt={item.name} style={{ width: "150px", borderRadius: "10px" }} />
              <p>{item.name}</p>
              <small>{item.type}</small>
            </div>
          ))}
        </div>
      )}

      {selectedSeason && (
        <>
          <div style={{ marginTop: "20px" }}>
            {episodes
              .filter((ep) => Number(ep.season) === Number(selectedSeason))
              .map((ep, i) => (
                <div
                  key={i}
                  onClick={async () => {
                    setLoading(true);

                    const url = `https://torrentio.strem.fun/stream/series/${selectedItem.id}:${ep.season}:${ep.episode}.json`;

                    const res = await fetch(url);
                    if (!res.ok) throw new Error("Request failed");

                    const data = await res.json();

                    setResults(formatTorrentio(data)); // ✅ FIX 1

                    setLoading(false);
                  }}
                >
                  <p>Episode {ep.episode}: {ep.title}</p>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

export default App;