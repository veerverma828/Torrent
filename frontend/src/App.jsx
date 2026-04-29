import { useState, useEffect, useRef } from "react";
import appLogo from "../Images/TITLE.png";
import "./App.css";

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
  const [movies, setMovies] = useState([]);
  const [series, setSeries] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);

  // ✅ NEW: Season bar scrolling state
  const seasonBarRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // ✅ NEW: Store default catalogs
  const [defaultMovies, setDefaultMovies] = useState([]);
  const [defaultSeries, setDefaultSeries] = useState([]);

  // ✅ NEW: Debrid service selector
  const [debridService, setDebridService] = useState("torbox"); // "real-debrid" or "torbox"

  const [rdUnlocked, setRdUnlocked] = useState(false);
  const [rdAdminCode, setRdAdminCode] = useState("");
  const [streamUrl, setStreamUrl] = useState(null);
  const [processingMagnet, setProcessingMagnet] = useState(null);

  // ✅ NEW: File Selection Modal state
  const [fileModalData, setFileModalData] = useState(null);
  const [processingFile, setProcessingFile] = useState(null);

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

  // ✅ NEW: Format bytes to MB/GB
  const formatBytes = (bytes) => {
    if (!bytes) return "0 MB";
    const mb = bytes / (1024 * 1024);
    if (mb > 1024) return (mb / 1024).toFixed(2) + " GB";
    return mb.toFixed(2) + " MB";
  };

  // ✅ NEW: Step 1 - Fetch files inside the torrent
  const initAction = async (magnet, actionType, autoPlayFirst = false) => {
    setProcessingMagnet(magnet);
    try {
      const headers = { "Content-Type": "application/json" };
      if (debridService === "real-debrid" && rdAdminCode) {
        headers["x-admin-code"] = rdAdminCode;
      }

      const res = await fetch(`${API}/get-files`, {
        method: "POST",
        headers,
        body: JSON.stringify({ magnet, service: debridService }),
      });
      const data = await res.json();

      if (data.files && data.files.length > 0) {
        // Auto-sort so largest files (video files) are at the top
        data.files.sort((a, b) => b.size - a.size);
        
        if (autoPlayFirst) {
          await selectFileAndExecute(data.files[0].id, data.torrentId, actionType);
        } else {
          setFileModalData({ magnet, torrentId: data.torrentId, files: data.files, actionType });
        }
      } else {
        alert(data.message || "❌ No files found or timeout.");
      }
    } catch (err) {
      alert("Error fetching files. Check console.");
      console.error(err);
    }
    setProcessingMagnet(null);
  };

  // ✅ NEW: Step 2 - Execute the specific file link
  const selectFileAndExecute = async (fileId, overrideTorrentId, overrideActionType) => {
    setProcessingFile(fileId);
    try {
      const headers = { "Content-Type": "application/json" };
      if (debridService === "real-debrid" && rdAdminCode) {
        headers["x-admin-code"] = rdAdminCode;
      }

      const torrentId = overrideTorrentId || (fileModalData ? fileModalData.torrentId : null);
      const action = overrideActionType || (fileModalData ? fileModalData.actionType : null);

      const res = await fetch(`${API}/generate-link`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          torrentId: torrentId,
          fileId,
          service: debridService
        }),
      });

      const data = await res.json();

      if (data.downloadUrl) {
        if (fileModalData) setFileModalData(null); // Close the modal immediately

        if (action === "download") {
          window.open(data.downloadUrl);
        } else if (action === "stream") {
          setStreamUrl(data.downloadUrl);
        } else if (action === "external") {
          const isAndroid = /Android/i.test(navigator.userAgent);
          const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

          if (isAndroid) {
            const urlObj = new URL(data.downloadUrl);
            window.location.href = `intent://${urlObj.host}${urlObj.pathname}${urlObj.search}#Intent;scheme=${urlObj.protocol.replace(":", "")};type=video/*;action=android.intent.action.VIEW;end`;
          } else if (isIOS) {
            window.location.href = `vlc://${data.downloadUrl}`;
          } else {
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
        }
      } else {
        alert(data.message || "❌ Failed to generate link. Torrent may not be fully cached yet.");
      }
    } catch (err) {
      alert("Error generating link.");
      console.error(err);
    }
    setProcessingFile(null);
  };

  // ✅ NEW: Season bar scroll logic
  const checkScroll = () => {
    if (seasonBarRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = seasonBarRef.current;
      setCanScrollLeft(scrollLeft > 0);
      // -1 buffer for rounding issues on high DPI screens
      setCanScrollRight(Math.round(scrollLeft + clientWidth) < scrollWidth - 1);
    }
  };

  useEffect(() => {
    const handleResizeOrUpdate = () => setTimeout(checkScroll, 50);
    handleResizeOrUpdate();
    window.addEventListener("resize", handleResizeOrUpdate);
    return () => window.removeEventListener("resize", handleResizeOrUpdate);
  }, [seasons, selectedItem]);

  const scrollSeasons = (direction) => {
    if (seasonBarRef.current) {
      const scrollAmount = 300; // Scrolls smoothly by 300px
      seasonBarRef.current.scrollBy({ left: direction === "left" ? -scrollAmount : scrollAmount, behavior: "smooth" });
    }
  };

  // ✅ NEW: Fetch default catalog on mount
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const res = await fetch(`${API}/catalog`);
        const data = await res.json();
        setDefaultMovies(data.movies || []);
        setDefaultSeries(data.series || []);
        setMovies(data.movies || []);
        setSeries(data.series || []);
      } catch (err) {
        console.error("Error fetching catalog:", err);
      }
    };
    fetchCatalog();
  }, [API]);

  // ✅ NEW: Restore default catalog when search is cleared
  useEffect(() => {
    if (query.trim() === "") {
      setMovies(defaultMovies);
      setSeries(defaultSeries);
      setResults([]);
      setSelectedItem(null);
      setSelectedSeason(null);
      setSeasons([]);
      setEpisodes([]);
    }
  }, [query, defaultMovies, defaultSeries]);

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
      }, 500); // ⏱ Reduced from 800ms to 500ms for snappier auto-searching

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
                                document.querySelector('.season-tab') || 
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
      if (fileModalData) {
        target = document.querySelector('.file-item'); // Targets the first file in popup
      } else if (results.length > 0) {
        target = document.querySelector('.result-btn'); // Targets the Stream button
      } else if (selectedSeason && episodes.length > 0) {
        target = document.querySelector('.episode-card');
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
  }, [results, seasons, episodes, selectedSeason, fileModalData]);

  return (
    <div className="app-container">

      <div className="logo-container">
        <img
          src={appLogo}
          alt="App Logo"
          className="app-logo"
          onClick={() => {
            setSelectedItem(null);
            setResults([]);
            setSeasons([]);
            setEpisodes([]);
            setSelectedSeason(null);
            setMovies(defaultMovies);
            setSeries(defaultSeries);
            setQuery("");
          }}
        />
      </div>

      {/* ✅ NEW: Debrid Service Selector */}
      <div className="options-container">
        <div className="debrid-selector">
          <label className="radio-label">
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
          <label className="radio-label">
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

      <div className="options-container" style={{ marginBottom: "10px" }}>
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

      <div className="search-container">
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
          className="search-input"
        />

        <button
          className="search-button"
          style={{
            backgroundColor: query.trim() ? "#007BFF" : "#444",
            cursor: query.trim() ? "pointer" : "not-allowed",
            boxShadow: query.trim() ? "0 4px 15px rgba(0, 123, 255, 0.4)" : "none",
          }}
          onClick={useJackett || imdbMode ? searchTorrents : searchContent}
          disabled={query.trim() === ""}
        >
          Search
        </button>
      </div>

      {loading && (
        <div className="center-margin-top">
          <span className="loader" title="Loading..."></span>
        </div>
      )}

      {!imdbMode && !selectedItem && results.length === 0 && (movies.length > 0 || series.length > 0) && (
        <div className="content-section">

          {/* 🎬 MOVIES */}
          {movies.length > 0 && (
            <>
              <h2 className="section-title">
                🎬 {query.trim() ? "Movies" : "Top Movies"}
              </h2>

              <div className="poster-grid">
                {movies.map((item, i) => (
                  <div key={i} className="poster-card" tabIndex="0"
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.click(); }}
                    onClick={async () => {
                    setSelectedItem(item);
                    setResults([]);
                    setSelectedSeason(null);
                    setSeasons([]);
                    setEpisodes([]);

                    if (item.type === "movie") {
                      setLoading(true);

                      const url = `https://torrentio.strem.fun/stream/movie/${item.id}.json`;
                      const res = await fetch(url);
                      const data = await res.json();

                      setResults(formatTorrentio(data));
                      setLoading(false);
                    }
                  }}>
                    <img src={item.poster} alt={item.name} />
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
              <h2 className="section-title" style={{ marginTop: "30px" }}>
                📺 {query.trim() ? "Series" : "Top Series"}
              </h2>

              <div className="poster-grid">
                {series.map((item, i) => (
                  <div key={i} className="poster-card" tabIndex="0"
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.click(); }}
                    onClick={async () => {
                    setSelectedItem(item);
                    setResults([]);
                    setSelectedSeason(null);
                    setSeasons([]);
                    setEpisodes([]);

                    setLoading(true);

                    const res = await fetch(`${API}/series-meta?id=${item.id}`);
                    const data = await res.json();

                    setSeasons(data.seasons);
                    setEpisodes(data.episodes);
                    if (data.seasons && data.seasons.length > 0) {
                      // Default to Season 1 if it exists, otherwise the first available season
                      const hasSeason1 = data.seasons.some(s => Number(s) === 1);
                      setSelectedSeason(hasSeason1 ? 1 : data.seasons[0]);
                    }

                    setLoading(false);
                  }}>
                    <img src={item.poster} alt={item.name} />
                    <p>{item.name}</p>
                    <small>{item.type}</small>
                  </div>
                ))}
              </div>
            </>
          )}

        </div>
      )}

      {!imdbMode && selectedItem && seasons.length > 0 && (
        <div className="series-view-container">
          <div className="center-margin-top">
            <button onClick={() => {
              setSelectedItem(null);
              setSeasons([]);
              setEpisodes([]);
              setSelectedSeason(null);
              setResults([]);
            }}>
              ⬅ Back to Search
            </button>
          </div>

          <div className="center-margin-top">
            <h2 style={{ marginBottom: "20px" }}>{selectedItem.name}</h2>
          </div>

          {/* SEASON BAR */}
          <div className="season-bar-container">
            {canScrollLeft && (
              <>
                <div className="fade-left"></div>
                <button className="scroll-arrow left" tabIndex="-1" onClick={() => scrollSeasons('left')}>
                  &#10094;
                </button>
              </>
            )}
            <div className="season-bar" ref={seasonBarRef} onScroll={checkScroll}>
              {seasons.map((s) => (
                <div
                  key={s}
                  className={`season-tab ${Number(selectedSeason) === Number(s) ? "active" : ""}`}
                  onMouseEnter={() => { setSelectedSeason(s); setResults([]); }}
                  onClick={() => { setSelectedSeason(s); setResults([]); }}
                  tabIndex="0"
                  onKeyDown={(e) => { if (e.key === "Enter") { setSelectedSeason(s); setResults([]); } }}
                >
                  Season {s}
                </div>
              ))}
            </div>
            {canScrollRight && (
              <>
                <div className="fade-right"></div>
                <button className="scroll-arrow right" tabIndex="-1" onClick={() => scrollSeasons('right')}>
                  &#10095;
                </button>
              </>
            )}
          </div>

          {/* EPISODES GRID */}
          {selectedSeason && (
            <div className="fade-in-episodes" key={selectedSeason} style={{ marginTop: "20px", width: "100%" }}>
              <div className="episodes-grid">
                {episodes
                  .filter((ep) => Number(ep.season) === Number(selectedSeason))
                  .map((ep, i) => {
                    const isUnreleased = ep.released ? new Date(ep.released) > new Date() : false;
                    
                    return (
                    <div key={i} className="episode-card" tabIndex="0"
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.click(); }}
                      onClick={async () => {
                        setLoading(true);

                        const url = `https://torrentio.strem.fun/stream/series/${selectedItem.id}:${ep.season}:${ep.episode}.json`;
                        const res = await fetch(url);
                        const data = await res.json();

                        setResults(formatTorrentio(data));
                        setLoading(false);
                      }}>
                      
                      <div className="episode-thumbnail">
                        <img src={ep.thumbnail || selectedItem.poster} alt={ep.name || ep.title || `Episode ${ep.episode}`} />
                        <div className="episode-number">Ep {ep.episode}</div>
                        <div className="episode-play-icon">▶</div>
                      </div>
                      
                      <div className="episode-info">
                        <h4>
                          <span className="episode-title-text" title={ep.name || ep.title || `Episode ${ep.episode}`}>
                            {ep.name || ep.title || `Episode ${ep.episode}`}
                          </span>
                          {isUnreleased && <span className="unreleased-badge">Unreleased</span>}
                        </h4>
                        {ep.released && (
                          <span className="episode-airdate">
                            {isUnreleased ? "Airs: " : "Aired: "} {new Date(ep.released).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                          </span>
                        )}
                        {ep.overview && <p className="episode-overview">{ep.overview}</p>}
                      </div>

                    </div>
                  )})}
              </div>
            </div>
          )}
        </div>
      )}

      {results.length > 0 && !imdbMode && selectedSeason === null && (
        <div className="center-margin-top">
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
        <div className="results-container">
          {results.map((item, index) => (
            <div key={index} className="result-item">
              <h3 className="result-title">{item.title}</h3>
              <p>Source: {item.provider}</p>

              {useJackett && (
                <>
                  <p>Size: {Math.round(item.size / 1000000)} MB</p>
                  <p>Seeders: {item.seeders}</p>
                </>
              )}

              <div className="button-container">
                <button
                  className="action-button"
                  onClick={() => initAction(item.magnet, 'download')}
                  disabled={processingMagnet === item.magnet}
                  style={{
                    background: processingMagnet === item.magnet ? "#6c757d" : "#007BFF",
                    cursor: processingMagnet === item.magnet ? "not-allowed" : "pointer",
                  }}
                >
                  {processingMagnet === item.magnet ? (
                <><span className="loader-small"></span> Processing ({debridService === "torbox" ? "Torbox" : "RD"})...</>
                  ) : (
                    `Download (${debridService === "torbox" ? "Torbox" : "RD"})`
                  )}
                </button>

                <button
                  className="action-button"
                  onClick={() => copyMagnet(item.magnet)}
                  style={{
                background: "#6c757d",
                    cursor: "pointer",
                  }}
                >
                  Copy Magnet
                </button>

                {/* ✅ NEW: Split Stream Button Group */}
                <div className="split-btn-group" style={{ marginLeft: "auto" }}>
                  <button
                    className="result-btn action-button split-btn-main"
                    onClick={() => initAction(item.magnet, 'stream', true)}
                    disabled={processingMagnet === item.magnet}
                    style={{
                      background: processingMagnet === item.magnet ? "#6c757d" : "#1e7e34",
                      cursor: processingMagnet === item.magnet ? "not-allowed" : "pointer",
                    }}
                    title="Instantly stream the main video file"
                  >
                    {processingMagnet === item.magnet ? (
                      <><span className="loader-small"></span> Loading...</>
                    ) : (
                      "▶ Stream"
                    )}
                  </button>
                  <button
                    className="action-button split-btn-arrow"
                    onClick={() => initAction(item.magnet, 'stream', false)}
                    disabled={processingMagnet === item.magnet}
                    style={{
                      background: processingMagnet === item.magnet ? "#6c757d" : "#1e7e34",
                      cursor: processingMagnet === item.magnet ? "not-allowed" : "pointer",
                    }}
                    title="Choose a specific file to stream"
                  >
                    ▼
                  </button>
                </div>

                {/* ✅ NEW: Split External Stream Button */}
                <div className="split-btn-group">
                  <button
                    className="result-btn action-button split-btn-main"
                    onClick={() => initAction(item.magnet, 'external', true)}
                    disabled={processingMagnet === item.magnet}
                    style={{
                      background: processingMagnet === item.magnet ? "#6c757d" : "#6f42c1",
                      cursor: processingMagnet === item.magnet ? "not-allowed" : "pointer",
                    }}
                    title="Instantly play the main video file in an external player"
                  >
                    {processingMagnet === item.magnet ? (
                      <><span className="loader-small"></span> Loading...</>
                    ) : (
                      "▶ External"
                    )}
                  </button>
                  <button
                    className="action-button split-btn-arrow"
                    onClick={() => initAction(item.magnet, 'external', false)}
                    disabled={processingMagnet === item.magnet}
                    style={{
                      background: processingMagnet === item.magnet ? "#6c757d" : "#6f42c1",
                      cursor: processingMagnet === item.magnet ? "not-allowed" : "pointer",
                    }}
                    title="Choose a specific file to play externally"
                  >
                    ▼
                  </button>
                </div>
              </div>

              {/* ✅ NEW: Inline File Selection Dropdown */}
              {fileModalData && fileModalData.magnet === item.magnet && (
                <div className="file-dropdown">
                  <div className="file-dropdown-header">
                    <span>Select a file to <strong>{fileModalData.actionType.charAt(0).toUpperCase() + fileModalData.actionType.slice(1)}</strong>:</span>
                    <button onClick={() => setFileModalData(null)} title="Close">✖</button>
                  </div>
                  <div className="file-list">
                    {fileModalData.files.map((f) => (
                      <div
                        key={f.id}
                        className="file-item"
                        tabIndex="0"
                        onKeyDown={(e) => { if (e.key === "Enter") selectFileAndExecute(f.id); }}
                        onClick={() => selectFileAndExecute(f.id)}
                        style={{
                          opacity: processingFile && processingFile !== f.id ? 0.5 : 1,
                          pointerEvents: processingFile ? "none" : "auto"
                        }}
                      >
                        <div className="file-name">
                          {processingFile === f.id && <span className="loader-small"></span>}
                          {f.name.replace(/^\//, "")}
                        </div>
                        <div className="file-size">{formatBytes(f.size)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

          ))}
        </div>
      )}

      {/* ✅ NEW: Video Player Modal */}
      {streamUrl && (
        <div className="video-modal">
          <button
            onClick={() => setStreamUrl(null)}
            className="video-close-btn"
          >
            ✖ Close
          </button>
          
          <video
            src={streamUrl}
            controls
            autoPlay
            playsInline
            className="video-player"
            onError={(e) => {
              const error = e.target.error;
              const errorMsg = error?.message || "Unknown error (likely unsupported format like MKV or CORS issue)";
              
              alert(`❌ Error playing video: ${errorMsg}\n\nTry downloading it instead.`);

              fetch(`${API}/log-stream-error`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                  url: streamUrl, 
                  rawMessage: error?.message || "", 
                  code: error?.code || "Unknown",
                  networkState: e.target.networkState,
                  readyState: e.target.readyState
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