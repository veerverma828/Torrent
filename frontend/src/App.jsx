import { useState, useEffect } from "react";
import appLogo from "../Images/TITLE.png";
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
  const [rdAdminCode, setRdAdminCode] = useState("");
  const [streamUrl, setStreamUrl] = useState(null);
  const [processingMagnet, setProcessingMagnet] = useState(null);

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

  // ✅ NEW: Helper to fetch the Debrid URL
  const fetchDebridUrl = async (magnet) => {
    const endpoint = debridService === "torbox" ? "/download-torbox" : "/download";

    const headers = {
      "Content-Type": "application/json",
    };

    if (debridService === "real-debrid" && rdAdminCode) {
      headers["x-admin-code"] = rdAdminCode;
    }

    const res = await fetch(`${API}${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ magnet }),
    });

    return await res.json();
  };

  // ✅ UPDATED: Download handler
  const handleDownload = async (magnet) => {
    setProcessingMagnet(magnet);
    const data = await fetchDebridUrl(magnet);
    setProcessingMagnet(null);

    if (data.downloadUrl) {
      window.open(data.downloadUrl);
    } else {
      alert(data.message);
    }
  };

  // ✅ NEW: Stream handler
  const handleStream = async (magnet) => {
    setProcessingMagnet(magnet);
    const data = await fetchDebridUrl(magnet);
    setProcessingMagnet(null);
    if (data.downloadUrl) {
      setStreamUrl(data.downloadUrl);
    } else {
      alert(data.message);
    }
  };

  // ✅ NEW: External Stream handler (Android Chooser / iOS VLC / PC Playlist)
  const handleExternalStream = async (magnet) => {
    setProcessingMagnet(magnet);
    const data = await fetchDebridUrl(magnet);
    setProcessingMagnet(null);
    if (data.downloadUrl) {
      const isAndroid = /Android/i.test(navigator.userAgent);
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

      if (isAndroid) {
        // Triggers Android's "Open With" app chooser for video players
        const urlObj = new URL(data.downloadUrl);
        window.location.href = `intent://${urlObj.host}${urlObj.pathname}${urlObj.search}#Intent;scheme=${urlObj.protocol.replace(":", "")};type=video/*;action=android.intent.action.VIEW;end`;
      } else if (isIOS) {
        // Fallback to VLC for iOS
        window.location.href = `vlc://${data.downloadUrl}`;
      } else {
        // Desktop (Windows/Mac/Linux): Generate a .m3u playlist file.
        // When you open this file, your OS will launch your default video player (VLC, PotPlayer, etc.)
        const m3uContent = `#EXTM3U\n#EXTINF:-1, Stream\n${data.downloadUrl}`;
        const blob = new Blob([m3uContent], { type: "audio/x-mpegurl" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Play_Stream.m3u";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
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

  // ✅ NEW: Global arrow-key keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) {
        const activeEl = document.activeElement;

        // ✨ Smart Input Navigation
        if (activeEl && activeEl.tagName === "INPUT") {
          if (activeEl.type === "text") {
            // Allow native left/right text navigation inside the search bar
            if (e.key === "ArrowLeft" && activeEl.selectionStart > 0) return;
            if (e.key === "ArrowRight" && activeEl.selectionStart < activeEl.value.length) return;
          } else {
            return; // Radios and Checkboxes keep their default native arrow behavior
          }
        }

        e.preventDefault(); // Prevent page scrolling with arrows
        
        // Find all visible, focusable elements on the screen
        const focusable = Array.from(
          document.querySelectorAll('button, input, [tabindex="0"]')
        ).filter(el => !el.disabled && (el.offsetWidth > 0 || el.offsetHeight > 0));
        
        const currentIndex = focusable.indexOf(activeEl);
        
        if (currentIndex === -1) {
          // ✨ Smart Fallback: if focus is lost, jump to the most relevant content!
          const defaultTarget = document.querySelector('.result-btn') || 
                                document.querySelector('.episode-card') || 
                                document.querySelector('.season-btn') || 
                                document.querySelector('.poster-card') || 
                                focusable[0];
          if (defaultTarget) {
            defaultTarget.focus({ preventScroll: true });
            defaultTarget.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          return;
        }

        let targetElement = null;

        if (e.key === "ArrowRight") {
          targetElement = focusable[(currentIndex + 1) % focusable.length];
        } else if (e.key === "ArrowLeft") {
          targetElement = focusable[(currentIndex - 1 + focusable.length) % focusable.length];
        } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          // ✨ Visual/Geometric navigation for Up/Down
          const currentRect = activeEl.getBoundingClientRect();
          const currentCenterX = currentRect.left + currentRect.width / 2;
          
          let bestMatch = null;
          let minDistance = Infinity;

          focusable.forEach(el => {
            if (el === activeEl) return;
            const rect = el.getBoundingClientRect();
            let isValidCandidate = false;
            let dy = 0;
            
            // Check if the element is physically below/above (with 10px margin of error)
            if (e.key === "ArrowDown" && rect.top >= currentRect.bottom - 10) {
              isValidCandidate = true;
              dy = rect.top - currentRect.bottom;
            } else if (e.key === "ArrowUp" && rect.bottom <= currentRect.top + 10) {
              isValidCandidate = true;
              dy = currentRect.top - rect.bottom;
            }
            
            if (isValidCandidate) {
              const targetCenterX = rect.left + rect.width / 2;
              const dx = Math.abs(currentCenterX - targetCenterX);
              
              // Multiply vertical distance by 10 to heavily prioritize the immediate next row
              const distance = (dy * 10) + dx;
              
              if (distance < minDistance) {
                minDistance = distance;
                bestMatch = el;
              }
            }
          });
          
          targetElement = bestMatch;
        }

        // ✨ TV-Style Smooth Centered Scrolling!
        if (targetElement) {
          targetElement.focus({ preventScroll: true }); // Prevent browser's instant jagged scroll
          targetElement.scrollIntoView({ behavior: "smooth", block: "center" }); // Smoothly center it
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ✅ NEW: Auto-focus newly loaded content for seamless keyboard navigation
  useEffect(() => {
    let attempts = 0;
    let timeoutId;

    const tryFocus = () => {
      // Prevent stealing focus if the user is actively typing in the search bar
      const activeEl = document.activeElement;
      if (activeEl && activeEl.tagName === "INPUT" && activeEl.type === "text") {
        return;
      }

      let target = null;
      if (results.length > 0) {
        target = document.querySelector('.result-btn'); // Targets the Stream button
      } else if (selectedSeason && episodes.length > 0) {
        target = document.querySelector('.episode-card');
      } else if (seasons.length > 0 && !selectedSeason) {
        target = document.querySelector('.season-btn');
      }

      if (target) {
        target.focus({ preventScroll: true });
        target.scrollIntoView({ behavior: "smooth", block: "center" }); // Premium smooth scroll!
      } else if (attempts < 5) {
        attempts++;
        timeoutId = setTimeout(tryFocus, 100);
      }
    };

    timeoutId = setTimeout(tryFocus, 50);
    return () => clearTimeout(timeoutId);
  }, [results, seasons, episodes, selectedSeason]);

  return (
    <div style={{
padding: "20px",
      backgroundColor: "#141414",
color: "#fff",
minHeight: "100vh",
fontFamily: "Arial, sans-serif",
width: "100vw",
maxWidth: "100vw",
margin: "0",
boxSizing: "border-box",
position: "relative",
left: "50%",
transform: "translateX(-50%)"
}}>
      {/* Global & Responsive CSS */}
      <style>{`
        /* Hide the horizontal scrollbar caused by 100vw pushing past the vertical scrollbar */
        body {
          overflow-x: hidden;
        }

        @media (max-width: 768px) {
          .button-container {
            flex-direction: column;
            align-items: center;
          }
          .button-container button {
            margin-left: 0 !important;
            width: 100%;
            max-width: 280px;
          }
        }

        /* Premium Hover Effect for Posters */
        .poster-card {
          transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        }
        .poster-card img {
          transition: box-shadow 0.3s ease-in-out;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        }
        .poster-card p {
          transition: color 0.3s ease;
        }
        
        /* Only apply hover effects on devices with a mouse cursor */
        @media (hover: hover) and (pointer: fine) {
          .poster-card:hover {
            transform: scale(1.08);
          }
          .poster-card:hover img {
            box-shadow: 0 12px 24px rgba(0, 0, 0, 0.8);
          }
          .poster-card:hover p {
            color: #007BFF;
          }
        }

        /* ✅ NEW: Premium Focus Styles for Keyboard Nav */
        .poster-card:focus, .episode-card:focus {
          outline: 3px solid #007BFF !important;
          outline-offset: 4px;
          border-radius: 10px;
        }
        .poster-card:focus {
          transform: scale(1.08);
        }
        .poster-card:focus img {
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.8);
        }
        .poster-card:focus p {
          color: #007BFF;
        }
        button:focus, input:focus {
          outline: 3px solid #007BFF !important;
          outline-offset: 2px;
        }
      `}</style>

      <div style={{ textAlign: "center", margin: "10px 0" }}>
        <img
          src={appLogo}
          alt="App Logo"
          style={{ width: "100%", maxWidth: "300px", height: "auto", objectFit: "contain", cursor: "pointer", outline: "none" }}
          onClick={() => {
            setSelectedItem(null);
            setResults([]);
            setSeasons([]);
            setEpisodes([]);
            setSelectedSeason(null);
            setSearchResults([]);
            setMovies([]);
            setSeries([]);
            setQuery("");
          }}
        />
      </div>

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
                      setRdAdminCode(code);
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
          style={{
            width: "100%",
            maxWidth: "500px",
            height: "46px",
            fontSize: "16px",
            padding: "8px 22px",
            borderRadius: "23px",
            border: "1px solid #444",
            backgroundColor: "#2a2a2a",
            color: "#fff",
            outline: "none",
            transition: "border-color 0.3s ease"
          }}
        />

        <button
          style={{
            width: "100%",
            maxWidth: "120px",
            height: "46px",
            borderRadius: "23px",
            border: "none",
            backgroundColor: query.trim() ? "#007BFF" : "#444",
            color: "#fff",
            fontWeight: "bold",
            fontSize: "16px",
            cursor: query.trim() ? "pointer" : "not-allowed",
            boxShadow: query.trim() ? "0 4px 15px rgba(0, 123, 255, 0.4)" : "none",
            transition: "all 0.3s ease"
          }}
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
                  <div key={i} className="poster-card" tabIndex="0" style={{ cursor: "pointer", textAlign: "center", outline: "none" }} 
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.click(); }}
                    onClick={async () => {
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
                  <div key={i} className="poster-card" tabIndex="0" style={{ cursor: "pointer", textAlign: "center", outline: "none" }} 
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.click(); }}
                    onClick={async () => {
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
              <button key={s} className="season-btn" onClick={() => setSelectedSeason(s)} style={{ margin: "5px" }}>
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
                <div key={i} className="episode-card" tabIndex="0" style={{ border: "1px solid gray", margin: "10px", padding: "10px", cursor: "pointer", borderRadius: "8px", outline: "none" }}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.click(); }}
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
            <div key={index} style={{ marginTop: "10px", border: "1px solid gray", padding: "10px", borderRadius: "8px", overflow: "hidden" }}>
              <h3 style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>{item.title}</h3>
              <p>Source: {item.provider}</p>

              {useJackett && (
                <>
                  <p>Size: {Math.round(item.size / 1000000)} MB</p>
                  <p>Seeders: {item.seeders}</p>
                </>
              )}

              <div className="button-container" style={{ display: "flex", gap: "10px", marginTop: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <button
                  onClick={() => handleDownload(item.magnet)}
                  disabled={processingMagnet === item.magnet}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "none",
                    background: processingMagnet === item.magnet ? "#6c757d" : "#007BFF",
                    color: "#fff",
                    cursor: processingMagnet === item.magnet ? "not-allowed" : "pointer",
                    fontWeight: "500",
                    minWidth: "165px"
                  }}
                >
                  {processingMagnet === item.magnet ? `⏳ Processing (${debridService === "torbox" ? "Torbox" : "RD"})...` : `Download (${debridService === "torbox" ? "Torbox" : "RD"})`}
                </button>

                <button
                  onClick={() => copyMagnet(item.magnet)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "none",
                background: "#6c757d",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: "500",
                    minWidth: "165px"
                  }}
                >
                  Copy Magnet
                </button>

                {/* ✅ NEW: Stream Button */}
                <button
                  className="result-btn"
                  onClick={() => handleStream(item.magnet)}
                  disabled={processingMagnet === item.magnet}
                  style={{
                    marginLeft: "auto",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "none",
                    background: processingMagnet === item.magnet ? "#6c757d" : "#1e7e34",
                    color: "#fff",
                    cursor: processingMagnet === item.magnet ? "not-allowed" : "pointer",
                    fontWeight: "500",
                    minWidth: "165px"
                  }}
                >
                  {processingMagnet === item.magnet ? `⏳ Loading (${debridService === "torbox" ? "Torbox" : "RD"})...` : "▶ Stream"}
                </button>

                {/* ✅ NEW: External Stream Button */}
                <button
                  onClick={() => handleExternalStream(item.magnet)}
                  disabled={processingMagnet === item.magnet}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "none",
                    background: processingMagnet === item.magnet ? "#6c757d" : "#6f42c1",
                    color: "#fff",
                    cursor: processingMagnet === item.magnet ? "not-allowed" : "pointer",
                    fontWeight: "500",
                    minWidth: "165px"
                  }}
                >
                  {processingMagnet === item.magnet ? `⏳ Loading (${debridService === "torbox" ? "Torbox" : "RD"})...` : "▶ External"}
                </button>
              </div>

            </div>

          ))}
        </div>
      )}

      {/* ✅ NEW: Video Player Modal */}
      {streamUrl && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
          backgroundColor: "rgba(0,0,0,0.95)", display: "flex", justifyContent: "center",
          alignItems: "center", zIndex: 9999, flexDirection: "column"
        }}>
          <button
            onClick={() => setStreamUrl(null)}
            style={{
              position: "absolute", top: "20px", right: "30px", padding: "10px 20px",
              background: "transparent", color: "#fff", border: "2px solid #fff",
              cursor: "pointer", borderRadius: "5px", fontSize: "16px", fontWeight: "bold"
            }}
          >
            ✖ Close
          </button>
          
          <video
            className="video-js vjs-default-skin vjs-big-play-centered"
            controls
            autoPlay
            style={{ width: "90%", maxWidth: "1200px", maxHeight: "80vh", borderRadius: "8px", outline: "none", backgroundColor: "#000" }}
            src={streamUrl}
            onError={(e) => {
              const videoEl = e.target;
              const error = videoEl.error;
              
              const errorMsg = error?.message || "Unknown error (likely unsupported format like MKV or CORS issue)";
              
              alert(`❌ Error playing video: ${errorMsg}\n\nTry downloading it instead.`);

              // Send error to the backend terminal
              fetch(`${API}/log-stream-error`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                  url: streamUrl, 
                  rawMessage: error?.message || "", 
                  code: error?.code || "Unknown",
                  networkState: videoEl.networkState,
                  readyState: videoEl.readyState
                })
              }).catch(err => console.log("Failed to send log to backend"));
            }}
          />
        </div>
      )}

    </div >
  );
}

export default App;
