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

    console.log("🔗 Adding magnet to Real-Debrid:", magnet);

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
    console.log("✅ Torrent added with ID:", torrentId);

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

      console.log(`⏳ Status check ${i + 1}/10: ${torrent.status}`);

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
        console.log("✅ Download URL obtained");
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

// 🎁 TORBOX DOWNLOAD
app.post("/download-torbox", async (req, res) => {
  const { magnet } = req.body;

  try {
    const API_KEY = process.env.TORBOX_API_KEY;

    if (!API_KEY) {
      return res.status(400).json({ message: "❌ Torbox API key not configured" });
    }

    console.log("🔗 Adding magnet to Torbox:", magnet);

    // Add magnet to Torbox
    const addRes = await axios.post(
      "https://api.torbox.app/v1/api/torrents/createMagnet",
      { magnet_link: magnet },
      {
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!addRes.data.success || !addRes.data.data) {
      console.error("Torbox response:", addRes.data);
      return res.status(500).json({ message: "❌ Failed to add magnet to Torbox" });
    }

    const torrentId = addRes.data.data.id;
    console.log("✅ Torrent added to Torbox with ID:", torrentId);

    let downloadUrl = null;

    // Poll for download status (up to 10 attempts with 5 second intervals)
    for (let i = 0; i < 10; i++) {
      const infoRes = await axios.get(
        `https://api.torbox.app/v1/api/torrents/status?id=${torrentId}`,
        {
          headers: {
            "Authorization": `Bearer ${API_KEY}`,
          },
        }
      );

      if (!infoRes.data.success || !infoRes.data.data) {
        console.error("Torbox status error:", infoRes.data);
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }

      const torrent = infoRes.data.data;

      console.log(`⏳ Torbox status check ${i + 1}/10: ${torrent.status}`);

      // Check if download is ready
      if (torrent.status === "downloaded" || torrent.status === "finished" || torrent.status === "ready") {
        // Get the files list
        const filesRes = await axios.get(
          `https://api.torbox.app/v1/api/torrents/files?id=${torrentId}`,
          {
            headers: {
              "Authorization": `Bearer ${API_KEY}`,
            },
          }
        );

        // Get the first available file
        if (filesRes.data.success && filesRes.data.data && filesRes.data.data.length > 0) {
          const fileId = filesRes.data.data[0].id;
          downloadUrl = `https://api.torbox.app/v1/api/torrents/download?token=${API_KEY}&torrent_id=${torrentId}&file_id=${fileId}`;
          console.log("✅ Download URL obtained from Torbox");
          break;
        }
      }

      await new Promise((r) => setTimeout(r, 5000));
    }

    if (downloadUrl) {
      res.json({ downloadUrl });
    } else {
      res.json({ message: "❌ Cannot be cached (timeout)" });
    }
  } catch (error) {
    console.error("TORBOX ERROR:", error.response?.data || error.message);
    res.status(500).json({ message: "Error processing torrent with Torbox" });
  }
});

// 🔍 Cinemeta Search
app.get("/search-content", async (req, res) => {
  const query = req.query.q;

  if (!query) {
    return res.status(400).json({ error: "Query is required" });
  }

  try {
    console.log("🔍 Searching Cinemeta for:", query);

    const movieURL = `https://v3-cinemeta.strem.io/catalog/movie/top/search=${query}.json`;
    const seriesURL = `https://v3-cinemeta.strem.io/catalog/series/top/search=${query}.json`;

    const [movieRes, seriesRes] = await Promise.all([
      axios.get(movieURL),
      axios.get(seriesURL),
    ]);

    const combined = [
      ...(movieRes.data.metas || []),
      ...(seriesRes.data.metas || []),
    ];

    console.log(`✅ Found ${combined.length} results`);

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
    console.log("🎬 Fetching series metadata for:", id);

    const response = await axios.get(
      `https://v3-cinemeta.strem.io/meta/series/${id}.json`
    );

    const videos = response.data.meta?.videos || [];
    const seasons = [...new Set(videos.map((v) => v.season))];

    console.log(`✅ Found ${seasons.length} seasons`);

    res.json({
      seasons,
      episodes: videos,
    });
  } catch (error) {
    console.error("CINEMETA ERROR:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch metadata" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});