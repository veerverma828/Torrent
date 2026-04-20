import { useState, useEffect } from "react";
// import "./App.css";

function App() {
  const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [autoSearch, setAutoSearch] = useState(true);
  const [useJackett, setUseJackett] = useState(false);

  const [seasons, setSeasons] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);

  const [loading, setLoading] = useState(false);

  const [imdbMode, setImdbMode] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [movies, setMovies] = useState([]);
  const [series, setSeries] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);

  // ✅ NEW: Debrid service selector
  const [debridService, setDebridService] = useState("torbox"); // "real-debrid" or "torbox"

  const [rdUnlocked, setRdUnlocked] = useState(false);

  // ✅ Helper function to format Torrentio results
  const formatTorrentio = (data) => {
    const streams = data.streams || [];

    return streams.map((item) => ({
      title: item.title,
      size: 0,
      seeders: 0,
      magnet: `magnet:?xt=urn:btih:${item.infoHash}`,
      provider: "Torrentio",
    }));
  };

  const searchContent = async () => {
    if (!query.trim()) return;

    setLoading(true);

    try {
      const res = await fetch(`${API}/search-content?q=${query}`);
      const data = await res.json();

      setSearchResults(data);

      // ✅ NEW: separate movies & series
      const movieList = data.filter((item) => item.type === "movie");
      const seriesList = data.filter((item) => item.type === "series");

      setMovies(movieList);
      setSeries(seriesList);

      setSelectedItem(null);
      setResults([]);
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
        const data = await res.json();
        setResults(data);
      } else {
        const url = `https://torrentio.strem.fun/stream/movie/${query}.json`;

        const res = await fetch(url);
        const data = await res.json();

        setResults(formatTorrentio(data));
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

  // ✅ UPDATED: Download handler with service selector
  const handleDownload = async (magnet) => {
    const endpoint = debridService === "torbox" ? "/download-torbox" : "/download";

    const res = await fetch(`${API}${endpoint}`, {
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

      {/* ✅ NEW: Debrid Service Selector */}
      <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginBottom: "15px", flexWrap: "wrap" }}>
        <div style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
          padding: "5px 8px",
          backgroundColor: "#1e1e1e",
          borderRadius: "6px",
          fontSize: "13px",
          border: "1px solid #333"
        }}>
          <label style={{ marginBottom: "0", fontSize: "13px", color: "#ccc" }}>
            <input
              type="radio"
              name="debrid"
              value="real-debrid"
              checked={debridService === "real-debrid"}
              onChange={async () => {
                if (rdUnlocked) {
                  setDebridService("real-debrid");
                } else {
                  const code = prompt("Enter access code for Real-Debrid:");

                  if (!code) return;

                  try {
                    const res = await fetch(`${API}/verify-rd`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json"
                      },
                      body: JSON.stringify({ code })
                    });

                    const data = await res.json();

                    if (data.success) {
                      setRdUnlocked(true);
                      setDebridService("real-debrid");
                    } else {
                      alert("❌ Only admin can access Real-Debrid");
                      setDebridService("torbox");
                    }

                  } catch (err) {
                    console.error(err);
                    alert("Error verifying access");
                  }
                }
              }}
            />
            {" "}Real-Debrid
          </label>
          <label style={{ marginBottom: "0", fontSize: "13px", color: "#ccc" }}>
            <input
              type="radio"
              name="debrid"
              value="torbox"
              checked={debridService === "torbox"}
              onChange={() => setDebridService("torbox")}
            />
            {" "}Torbox
          </label>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginBottom: "10px", flexWrap: "wrap" }}>
        <label>
          <input type="checkbox" checked={autoSearch} onChange={() => setAutoSearch(!autoSearch)} />
          {" "}Auto Search
        </label>

        <label>
          <input type="checkbox" checked={useJackett} onChange={() => setUseJackett(!useJackett)} />
          {" "}Jackett
        </label>

        <label>
          <input type="checkbox" checked={imdbMode} onChange={() => setImdbMode(!imdbMode)} />
          {" "}IMDb Mode
        </label>
      </div>

      <div style={{ display: "flex", gap: "10px", justifyContent: "center", alignItems: "center", marginTop: "20px", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder={
            imdbMode
              ? "Enter IMDb ID (e.g. tt10872600)"
              : useJackett
                ? "Search torrents..."
                : "Search movies or series..."
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (!autoSearch && e.key === "Enter") {
              useJackett || imdbMode ? searchTorrents() : searchContent();
            }
          }}
          style={{ width: "100%", maxWidth: "500px", height: "40px", fontSize: "16px", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
        />

        <button
          style={{ width: "100%", maxWidth: "120px", height: "42px", borderRadius: "6px", cursor: query.trim() ? "pointer" : "not-allowed", opacity: query.trim() ? 1 : 0.5 }}
          onClick={useJackett || imdbMode ? searchTorrents : searchContent}
          disabled={query.trim() === ""}
        >
          Search
        </button>
      </div>

      {loading && <p style={{ textAlign: "center", marginTop: "20px" }}>⏳ Loading...</p>}

      {!imdbMode && !selectedItem && searchResults.length > 0 && (
        <div style={{ marginTop: "20px" }}>

          {/* 🎬 MOVIES */}
          {movies.length > 0 && (
            <>
              {/* <h2 style={{ textAlign: "center" }}>Movies</h2> */}
              <h2 style={{
                fontSize: "22px",
                fontWeight: "600",
                margin: "20px 0 10px 20px",
                color: "#fff",
                letterSpacing: "0.5px"
              }}>
                🎬 Movies
              </h2>

              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, 150px)",
                gap: "15px",
                justifyContent: "center"
              }}>
                {movies.map((item, i) => (
                  <div key={i} style={{ cursor: "pointer", textAlign: "center" }} onClick={async () => {
                    setSelectedItem(item);
                    setResults([]);
                    setSelectedSeason(null);

                    if (item.type === "movie") {
                      setLoading(true);

                      const url = `https://torrentio.strem.fun/stream/movie/${item.id}.json`;
                      const res = await fetch(url);
                      const data = await res.json();

                      setResults(formatTorrentio(data));
                      setLoading(false);
                    }
                  }}>
                    <img src={item.poster} alt={item.name} style={{ width: "150px", borderRadius: "10px" }} />
                    <p>{item.name}</p>
                    <small>{item.type}</small>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 📺 SERIES */}
          {series.length > 0 && (
            <>
              <h2 style={{
                fontSize: "22px",
                fontWeight: "600",
                margin: "30px 0 10px 20px",
                color: "#fff",
                letterSpacing: "0.5px"
              }}>
                📺 Series
              </h2>

              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, 150px)",
                gap: "15px",
                justifyContent: "center"
              }}>
                {series.map((item, i) => (
                  <div key={i} style={{ cursor: "pointer", textAlign: "center" }} onClick={async () => {
                    setSelectedItem(item);
                    setResults([]);
                    setSelectedSeason(null);

                    setLoading(true);

                    const res = await fetch(`${API}/series-meta?id=${item.id}`);
                    const data = await res.json();

                    setSeasons(data.seasons);
                    setEpisodes(data.episodes);

                    setLoading(false);
                  }}>
                    <img src={item.poster} alt={item.name} style={{ width: "150px", borderRadius: "10px" }} />
                    <p>{item.name}</p>
                    <small>{item.type}</small>
                  </div>
                ))}
              </div>
            </>
          )}

        </div>
      )}

      {!imdbMode && selectedItem && seasons.length > 0 && !selectedSeason && (
        <>
          <div style={{ textAlign: "center", marginTop: "20px" }}>
            <button onClick={() => {
              setSelectedItem(null);
              setSeasons([]);
              setEpisodes([]);
            }}>
              ⬅ Back
            </button>
          </div>

          <div style={{ textAlign: "center", marginTop: "20px" }}>
            <h2>{selectedItem.name}</h2>
            <h3>Select Season</h3>

            {seasons.map((s) => (
              <button key={s} onClick={() => setSelectedSeason(s)} style={{ margin: "5px" }}>
                Season {s}
              </button>
            ))}
          </div>
        </>
      )}

      {selectedSeason && (
        <>
          <div style={{ textAlign: "center", marginTop: "20px" }}>
            <button onClick={() => setSelectedSeason(null)}>⬅ Back to Seasons</button>
          </div>

          <div style={{ marginTop: "20px" }}>
            <h2 style={{ textAlign: "center" }}>Season {selectedSeason}</h2>

            {episodes
              .filter((ep) => Number(ep.season) === Number(selectedSeason))
              .map((ep, i) => (
                <div key={i} style={{ border: "1px solid gray", margin: "10px", padding: "10px", cursor: "pointer", borderRadius: "8px" }}
                  onClick={async () => {
                    setLoading(true);

                    const url = `https://torrentio.strem.fun/stream/series/${selectedItem.id}:${ep.season}:${ep.episode}.json`;
                    const res = await fetch(url);
                    const data = await res.json();

                    setResults(formatTorrentio(data));
                    setLoading(false);
                  }}>
                  <p>Episode {ep.episode}: {ep.title}</p>
                </div>
              ))}
          </div>
        </>
      )}

      {results.length > 0 && !imdbMode && selectedSeason === null && (
        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <button onClick={() => {
            setResults([]);

            if (selectedSeason) {
              setSelectedSeason(null);
            } else if (selectedItem) {
              setSelectedItem(null);
            }
          }}>
            ⬅ Back
          </button>
        </div>
      )}

      {(imdbMode || results.length > 0) && (
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          {results.map((item, index) => (
            <div key={index} style={{ marginTop: "10px", border: "1px solid gray", padding: "10px", borderRadius: "8px" }}>
              <h3>{item.title}</h3>
              <p>Source: {item.provider}</p>

              {useJackett && (
                <>
                  <p>Size: {Math.round(item.size / 1000000)} MB</p>
                  <p>Seeders: {item.seeders}</p>
                </>
              )}

              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                {item.magnet ? (
                  <>
                    <button onClick={() => copyMagnet(item.magnet)}>Copy Magnet</button>
                    <button onClick={() => handleDownload(item.magnet)}>
                      Download ({debridService === "torbox" ? "Torbox" : "RD"})
                    </button>
                  </>
                ) : (
                  <button disabled style={{ backgroundColor: "gray" }}>
                    Magnet Unavailable
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
