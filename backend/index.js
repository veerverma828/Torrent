import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import axios from "axios";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// ✅ Common headers (Cloudflare fix)
const AXIOS_CONFIG = {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
  },
  timeout: 10000,
};

// Root route
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

// 🔍 SEARCH API (Jackett)
app.get("/search", async (req, res) => {
  const query = req.query.q;

  if (!query) {
    return res.status(400).json({ error: "Query is required" });
  }

  try {
    const response = await axios.get(
      "http://localhost:9117/api/v2.0/indexers/all/results",
      {
        ...AXIOS_CONFIG,
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
    console.error("Search Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Error fetching torrents" });
  }
});

// 🚀 REAL-DEBRID DOWNLOAD
app.post("/download", async (req, res) => {
  const { magnet } = req.body;

  try {
    const API_KEY = process.env.REAL_DEBRID_API_KEY;

    const addRes = await axios.post(
      "https://api.real-debrid.com/rest/1.0/torrents/addMagnet",
      new URLSearchParams({ magnet }),
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          ...AXIOS_CONFIG.headers,
        },
      }
    );

    const torrentId = addRes.data.id;

    await axios.post(
      `https://api.real-debrid.com/rest/1.0/torrents/selectFiles/${torrentId}`,
      new URLSearchParams({ files: "all" }),
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          ...AXIOS_CONFIG.headers,
        },
      }
    );

    let downloadUrl = null;

    for (let i = 0; i < 10; i++) {
      const infoRes = await axios.get(
        `https://api.real-debrid.com/rest/1.0/torrents/info/${torrentId}`,
        {
          ...AXIOS_CONFIG,
          headers: {
            Authorization: `Bearer ${API_KEY}`,
            ...AXIOS_CONFIG.headers,
          },
        }
      );

      const torrent = infoRes.data;

      if (torrent.status === "downloaded") {
        const link = torrent.links[0];

        const unrestrict = await axios.post(
          "https://api.real-debrid.com/rest/1.0/unrestrict/link",
          new URLSearchParams({ link }),
          {
            headers: {
              Authorization: `Bearer ${API_KEY}`,
              ...AXIOS_CONFIG.headers,
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

// 🚀 TORRENTIO SEARCH
app.get("/torrentio-search", async (req, res) => {
  const imdbId = req.query.imdb;
  const type = req.query.type;
  const season = req.query.season;
  const episode = req.query.episode;

  try {
    if (!imdbId || !imdbId.startsWith("tt")) {
      return res.status(400).json({ error: "Invalid IMDb ID" });
    }

    let url;

    if (type === "series" && season && episode) {
      url = `https://torrentio.strem.fun/stream/series/${imdbId}:${season}:${episode}.json`;
    } else {
      url = `https://torrentio.strem.fun/stream/movie/${imdbId}.json`;
    }

    // ✅ Small delay (anti-bot)
    await new Promise((r) => setTimeout(r, 300));

    const response = await axios.get(url, AXIOS_CONFIG);

    const streams = response.data.streams;

    if (!streams || streams.length === 0) {
      return res.json([]);
    }

    const results = streams.map((item) => ({
      title: item.title,
      size: 0,
      seeders: 0,
      magnet: `magnet:?xt=urn:btih:${item.infoHash}`,
      provider: "Torrentio",
    }));

    res.json(results);
  } catch (error) {
    console.error("TORRENTIO ERROR:", error.response?.data || error.message);
    res.status(500).json({ error: "Torrentio failed" });
  }
});

// 🔍 Cinemeta Search
app.get("/search-content", async (req, res) => {
  const query = req.query.q;

  if (!query) {
    return res.status(400).json({ error: "Query is required" });
  }

  try {
    const movieURL = `https://v3-cinemeta.strem.io/catalog/movie/top/search=${query}.json`;
    const seriesURL = `https://v3-cinemeta.strem.io/catalog/series/top/search=${query}.json`;

    const [movieRes, seriesRes] = await Promise.all([
      axios.get(movieURL, AXIOS_CONFIG),
      axios.get(seriesURL, AXIOS_CONFIG),
    ]);

    const combined = [
      ...(movieRes.data.metas || []),
      ...(seriesRes.data.metas || []),
    ];

    res.json(combined);
  } catch (error) {
    console.error("SEARCH ERROR:", error.response?.data || error.message);
    res.status(500).json({ error: "Search failed" });
  }
});

// 🎬 SERIES META
app.get("/series-meta", async (req, res) => {
  const id = req.query.id;

  if (!id) {
    return res.status(400).json({ error: "ID is required" });
  }

  try {
    const response = await axios.get(
      `https://v3-cinemeta.strem.io/meta/series/${id}.json`,
      AXIOS_CONFIG
    );

    const videos = response.data.meta?.videos || [];
    const seasons = [...new Set(videos.map((v) => v.season))];

    res.json({
      seasons,
      episodes: videos,
    });
  } catch (error) {
    console.error("CINEMETA ERROR:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch metadata" });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});