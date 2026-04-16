import { useState, useEffect } from "react";

function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [autoSearch, setAutoSearch] = useState(false);
  const [useJackett, setUseJackett] = useState(false);

  const [seasons, setSeasons] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);

  const [loading, setLoading] = useState(false);

  // 🔥 NEW STATES
  const [imdbMode, setImdbMode] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);

  // 🔍 CINEMETA SEARCH
  const searchContent = async () => {
    if (!query.trim()) return;

    setLoading(true);   // 🔥 ADD

    try {
      const res = await fetch(
        `http://localhost:5000/search-content?q=${query}`
      );
      const data = await res.json();

      setSearchResults(data);
      setSelectedItem(null);
      setResults([]);
    } catch (err) {
      console.error(err);
    }

    setLoading(false);  // 🔥 ADD
  };

  // 🔎 TORRENT SEARCH (UNCHANGED)
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
        const res = await fetch(`http://localhost:5000/search?q=${query}`);
        const data = await res.json();
        setResults(data);
      } else {
        const res = await fetch(
          `http://localhost:5000/torrentio-search?imdb=${query}`
        );
        const data = await res.json();
        setResults(data);
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
    const res = await fetch("http://localhost:5000/download", {
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
    }, 300);

    return () => clearTimeout(delay);
  }, [query, autoSearch, useJackett, imdbMode]);

  return (
    <div style={{ padding: "20px" }}>
      <h1 style={{ textAlign: "center" }}>Debrid Download ⚡</h1>

      {/* TOGGLES */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "20px",
          marginBottom: "10px",
        }}
      >
        <label>
          <input
            type="checkbox"
            checked={autoSearch}
            onChange={() => setAutoSearch(!autoSearch)}
          />
          {" "}Auto Search
        </label>

        <label>
          <input
            type="checkbox"
            checked={useJackett}
            onChange={() => setUseJackett(!useJackett)}
          />
          {" "}Jackett
        </label>

        {/* 🔥 NEW TOGGLE */}
        <label>
          <input
            type="checkbox"
            checked={imdbMode}
            onChange={() => setImdbMode(!imdbMode)}
          />
          {" "}IMDb Mode
        </label>
      </div>

      {/* INPUT */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          justifyContent: "center",
          alignItems: "center",
          marginTop: "20px",
          flexWrap: "wrap",
        }}
      >
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
          style={{
            width: "100%",
            maxWidth: "500px",
            height: "40px",
            fontSize: "16px",
            padding: "8px",
            borderRadius: "6px",
            border: "1px solid #ccc",
          }}
        />

        <button
          style={{
            width: "100%",
            maxWidth: "120px",
            height: "42px",
            borderRadius: "6px",
            cursor: query.trim() ? "pointer" : "not-allowed",
            opacity: query.trim() ? 1 : 0.5,
          }}
          onClick={useJackett || imdbMode ? searchTorrents : searchContent}
          disabled={query.trim() === ""}
        >
          Search
        </button>
      </div>

      {loading && (
        <p style={{ textAlign: "center", marginTop: "20px" }}>
          ⏳ Loading...
        </p>
      )}

      {/* 🔥 POSTER GRID */}
      {!imdbMode && !selectedItem && searchResults.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, 150px)",
            gap: "15px",
            marginTop: "20px",
            justifyContent: "center",
          }}
        >
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

                  const res = await fetch(
                    `http://localhost:5000/torrentio-search?imdb=${item.id}`
                  );
                  const data = await res.json();
                  setResults(data);
                  setLoading(false);
                }
                else {
                  setLoading(true);

                  const res = await fetch(
                    `http://localhost:5000/series-meta?id=${item.id}`
                  );

                  const data = await res.json();

                  setSeasons(data.seasons);
                  setEpisodes(data.episodes);

                  setLoading(false);
                }
              }}
            >
              <img
                src={item.poster}
                alt={item.name}
                style={{ width: "150px", borderRadius: "10px" }}
              />
              <p>{item.name}</p>
              <small>{item.type}</small>
            </div>
          ))}
        </div>
      )}

      {/* Season UI */}
      {!imdbMode && selectedItem && seasons.length > 0 && !selectedSeason && (
        <>
          {/* 🔙 BACK BUTTON */}
          <div style={{ textAlign: "center", marginTop: "20px" }}>
            <button
              onClick={() => {
                setSelectedItem(null);
                setSeasons([]);
                setEpisodes([]);
              }}
            >
              ⬅ Back to Search
            </button>
          </div>

          {/* 📺 SEASON UI */}
          <div style={{ textAlign: "center", marginTop: "20px" }}>
            <h2>{selectedItem.name}</h2>
            <h3>Select Season</h3>

            {seasons.map((s) => (
              <button
                key={s}
                onClick={() => setSelectedSeason(s)}
                style={{ margin: "5px" }}
              >
                Season {s}
              </button>
            ))}
          </div>
        </>
      )}
      {/* Episode UI */}

      {selectedSeason && (
        <>
          <div style={{ textAlign: "center", marginTop: "20px" }}>
            <button onClick={() => setSelectedSeason(null)}>
              ⬅ Back to Seasons
            </button>
          </div>

          <div style={{ marginTop: "20px" }}>

            <h2 style={{ textAlign: "center" }}>
              Season {selectedSeason}
            </h2>

            {episodes
              // .filter((ep) => ep.season === selectedSeason)
              .filter((ep) => Number(ep.season) === Number(selectedSeason))
              .map((ep, i) => (
                <div
                  key={i}
                  style={{
                    border: "1px solid gray",
                    margin: "10px",
                    padding: "10px",
                    cursor: "pointer",
                    borderRadius: "8px"
                  }}
                  onClick={async () => {
                    setLoading(true);

                    const res = await fetch(
                      `http://localhost:5000/torrentio-search?imdb=${selectedItem.id}&type=series&season=${ep.season}&episode=${ep.episode}`
                    );

                    const data = await res.json();
                    setResults(data);
                    setLoading(false);
                  }}
                >
                  <p>
                    Episode {ep.episode}: {ep.title}
                  </p>
                </div>
              ))}
          </div>
        </>
      )}

      {results.length > 0 && !imdbMode && (
        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <button onClick={() => setResults([])}>
            ⬅ Back to Episodes
          </button>
        </div>
      )}

      {/* 🔴 STREAM RESULTS */}
      {(imdbMode || results.length > 0) && (
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          {results.map((item, index) => (
            <div
              key={index}
              style={{
                marginTop: "10px",
                border: "1px solid gray",
                padding: "10px",
                borderRadius: "8px",
              }}
            >
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
                    <button onClick={() => copyMagnet(item.magnet)}>
                      Copy Magnet
                    </button>

                    <button onClick={() => handleDownload(item.magnet)}>
                      Download (RD)
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