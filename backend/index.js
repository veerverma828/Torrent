import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import axios from "axios";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Root route
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

// 🔍 SEARCH API (Jackett) — unchanged
app.get("/search", async (req, res) => {
  const query = req.query.q;

  if (!query) {
    return res.status(400).json({ error: "Query is required" });
  }

  try {
    const response = await axios.get(
      "http://localhost:9117/api/v2.0/indexers/all/results",
      {
        params: {
          apikey: process.env.JACKETT_API_KEY,
          Query: query,
        },
      }
    );

    const results = response.data.Results
      .map((item) => ({
        title: item.Title,
        size: item.Size,
        seeders: item.Seeders || 0,
        magnet: item.MagnetUri,
        provider: item.Tracker || item.Indexer || "Unknown",
      }))
      .sort((a, b) => b.seeders - a.seeders);

    res.json(results);

  } catch (error) {
    console.error("Search Error:", error.message);
    res.status(500).json({ error: "Error fetching torrents" });
  }
});

// 🚀 REAL-DEBRID DOWNLOAD — unchanged
app.post("/download", async (req, res) => {
  const { magnet } = req.body;

  try {
    const API_KEY = process.env.REAL_DEBRID_API_KEY;

    console.log("API KEY:", API_KEY);

    // 1️⃣ Add magnet
    const addRes = await axios.post(
      "https://api.real-debrid.com/rest/1.0/torrents/addMagnet",
      new URLSearchParams({ magnet }),
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      }
    );

    const torrentId = addRes.data.id;

    // 2️⃣ Select files
    await axios.post(
      `https://api.real-debrid.com/rest/1.0/torrents/selectFiles/${torrentId}`,
      new URLSearchParams({ files: "all" }),
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      }
    );

    let downloadUrl = null;

    // 3️⃣ Polling
    for (let i = 0; i < 10; i++) {
      const infoRes = await axios.get(
        `https://api.real-debrid.com/rest/1.0/torrents/info/${torrentId}`,
        {
          headers: {
            Authorization: `Bearer ${API_KEY}`,
          },
        }
      );

      const torrent = infoRes.data;

      console.log("STATUS:", torrent.status);

      if (torrent.status === "downloaded") {
        const link = torrent.links[0];

        const unrestrict = await axios.post(
          "https://api.real-debrid.com/rest/1.0/unrestrict/link",
          new URLSearchParams({ link }),
          {
            headers: {
              Authorization: `Bearer ${API_KEY}`,
            },
          }
        );

        downloadUrl = unrestrict.data.download;
        break;
      }

      await new Promise((r) => setTimeout(r, 5000));
    }

    if (downloadUrl) {
      res.json({ downloadUrl });
    } else {
      res.json({ message: "❌ Cannot be cached (timeout)" });
    }

  } catch (error) {
    console.error("RD ERROR:", error.response?.data || error.message);
    res.status(500).json({ message: "Error processing torrent" });
  }
});

// 🚀 TORRENTIO SEARCH (IMDb BASED ONLY)
app.get("/torrentio-search", async (req, res) => {
  const imdbId = req.query.imdb;
  const type = req.query.type;
  const season = req.query.season;
  const episode = req.query.episode;

  try {
    console.log("🎯 IMDb received:", imdbId);
    if (type === "series") {
      console.log("📺 Series Mode");
      console.log("👉 Season:", season);
      console.log("👉 Episode:", episode);
    } else {
      console.log("🎥 Movie Mode");
    }

    // ✅ Validate IMDb ID
    if (!imdbId || !imdbId.startsWith("tt")) {
      return res.status(400).json({ error: "Invalid IMDb ID" });
    }

    // 1️⃣ Call Torrentio
    // 🔥 Decide correct endpoint
    let url;

    if (type === "series" && season && episode) {
      console.log("✅ Using SERIES endpoint");

      url = `https://torrentio.strem.fun/stream/series/${imdbId}:${season}:${episode}.json`;
    } else {
      console.log("🎥 Using MOVIE endpoint");

      url = `https://torrentio.strem.fun/stream/movie/${imdbId}.json`;
    }

    console.log("🌐 Calling:", url);

    const response = await axios.get(url);

    const streams = response.data.streams;

    if (!streams || streams.length === 0) {
      console.log("❌ No streams found");
      return res.json([]);
    }

    // 2️⃣ Convert to your format
    const results = streams.map((item) => ({
      title: item.title,
      size: 0,
      seeders: 0,
      magnet: `magnet:?xt=urn:btih:${item.infoHash}`,
      provider: "Torrentio",
    }));

    console.log("✅ Streams found:", results.length);

    res.json(results);

  } catch (error) {
    console.error("🚨 TORRENTIO ERROR:", error.response?.data || error.message);
    res.status(500).json({ error: "Torrentio failed" });
  }
});

//Search functionality for addon
// 🔍 Cinemeta Search (Movies + Series)
app.get("/search-content", async (req, res) => {
  const query = req.query.q;

  if (!query) {
    return res.status(400).json({ error: "Query is required" });
  }

  try {
    console.log("🔍 Searching:", query);

    const movieURL = `https://v3-cinemeta.strem.io/catalog/movie/top/search=${query}.json`;
    const seriesURL = `https://v3-cinemeta.strem.io/catalog/series/top/search=${query}.json`;

    // 🚀 Run both in parallel
    const [movieRes, seriesRes] = await Promise.all([
      axios.get(movieURL),
      axios.get(seriesURL),
    ]);

    const movies = movieRes.data.metas || [];
    const series = seriesRes.data.metas || [];

    // 🧠 Merge results
    const combined = [...movies, ...series];

    console.log(`✅ Found ${combined.length} results`);

    res.json(combined);

  } catch (error) {
    console.error("🚨 SEARCH ERROR:", error.message);
    res.status(500).json({ error: "Search failed" });
  }
});

// 🎬 SERIES METADATA (Cinemeta → backend)
app.get("/series-meta", async (req, res) => {
  const id = req.query.id;

  if (!id) {
    return res.status(400).json({ error: "ID is required" });
  }

  try {
    const response = await axios.get(
      `https://v3-cinemeta.strem.io/meta/series/${id}.json`
    );

    const videos = response.data.meta?.videos || [];

    const seasons = [...new Set(videos.map(v => v.season))];

    res.json({
      seasons,
      episodes: videos,
    });

  } catch (error) {
    console.error("CINEMETA ERROR:", error.message);
    res.status(500).json({ error: "Failed to fetch metadata" });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});