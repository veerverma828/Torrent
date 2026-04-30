import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import axios from "axios";
import fs from "fs";

dotenv.config();

const app = express();

// app.use(cors({
//   origin: "https://torrent-gamma.vercel.app"
// }));

// app.use(cors());

// 🔒 Advanced CORS Configuration - Restricted to allowed origins
const allowedOrigins = [
  "https://torrent-gamma.vercel.app",  // Production
  "http://localhost:5173",              // Local frontend (Vite default)
  "http://localhost:3000"               // Alternative local port
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS not allowed"));
    }
  },
  credentials: true,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "x-admin-code"]
}));

app.use(express.json());

// 📝 Helper function to log to a text file
const logToFile = (message) => {
  const timestamp = new Date().toISOString();
  fs.appendFile("downloads.log", `[${timestamp}] ${message}\n`, (err) => {
    if (err) console.error("Error writing to log file:", err);
  });
};

// Root route
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

// 🔴 STREAM ERROR LOGGING (From Frontend)
app.post("/log-stream-error", (req, res) => {
  const { url, rawMessage, code, networkState, readyState } = req.body;
  console.error("\n❌ [RAW STREAM ERROR] ----------------------------");
  console.error("🔗 URL:", url);
  console.error("🛠 MediaError Code:", code);
  console.error("📝 Exact Message:", rawMessage === "" ? '"" (Browser provided no message)' : rawMessage);
  console.error("📡 Network State:", networkState);
  console.error("⏳ Ready State:", readyState, "\n--------------------------------------------------");
  res.json({ success: true });
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

// 🗂 GET FILES (STEP 1)
app.post("/get-files", async (req, res) => {
  const { magnet, service } = req.body;
  const adminCode = req.headers["x-admin-code"];

  logToFile(`📂 Fetching files via ${service} for magnet: ${magnet.substring(0, 40)}...`);

  if (service === "real-debrid") {
    if (adminCode !== process.env.RD_ADMIN_CODE) {
      return res.status(403).json({ message: "❌ Unauthorized" });
    }
    try {
      const API_KEY = process.env.REAL_DEBRID_API_KEY;
      const addRes = await axios.post("https://api.real-debrid.com/rest/1.0/torrents/addMagnet", new URLSearchParams({ magnet }), { headers: { Authorization: `Bearer ${API_KEY}` } });
      const torrentId = addRes.data.id;

      // Wait for files metadata
      for (let i = 0; i < 15; i++) {
        const info = await axios.get(`https://api.real-debrid.com/rest/1.0/torrents/info/${torrentId}`, { headers: { Authorization: `Bearer ${API_KEY}` } });
        if (info.data.status === "waiting_files_selection" || (info.data.files && info.data.files.length > 0)) {
          return res.json({
            torrentId,
            files: info.data.files.map(f => ({ id: f.id, name: f.path, size: f.bytes }))
          });
        }
        await new Promise(r => setTimeout(r, 2000));
      }
      return res.status(408).json({ message: "⏳ Timeout waiting for torrent metadata." });
    } catch (error) {
      console.error(error.response?.data || error.message);
      return res.status(500).json({ message: "Error fetching files from Real-Debrid" });
    }
  }

  if (service === "torbox") {
    try {
      const API_KEY = process.env.TORBOX_API_KEY;
      const addRes = await axios.post("https://api.torbox.app/v1/api/torrents/createtorrent", new URLSearchParams({ magnet }), { headers: { Authorization: `Bearer ${API_KEY}` } });
      if (!addRes.data.success) return res.status(500).json({ message: "❌ Failed to add magnet to Torbox" });
      const torrentId = addRes.data.data.torrent_id;

      // Wait for files in mylist
      for (let i = 0; i < 15; i++) {
        const listRes = await axios.get("https://api.torbox.app/v1/api/torrents/mylist", { headers: { Authorization: `Bearer ${API_KEY}` } });
        const torrent = listRes.data.data?.find(t => t.id === torrentId);
        if (torrent && torrent.files && torrent.files.length > 0) {
          return res.json({
            torrentId,
            files: torrent.files.map(f => ({ id: f.id, name: f.name, size: f.size }))
          });
        }
        await new Promise(r => setTimeout(r, 2000));
      }
      return res.status(408).json({ message: "⏳ Timeout waiting for torrent metadata." });
    } catch (error) {
      console.error(error.response?.data || error.message);
      return res.status(500).json({ message: "Error fetching files from Torbox" });
    }
  }
});

// 🔗 GENERATE LINK (STEP 2)
app.post("/generate-link", async (req, res) => {
  const { torrentId, fileId, service } = req.body;
  const adminCode = req.headers["x-admin-code"];

  logToFile(`🔗 Generating link via ${service} for torrentId: ${torrentId}, fileId: ${fileId}`);

  if (service === "real-debrid") {
    if (adminCode !== process.env.RD_ADMIN_CODE) return res.status(403).json({ message: "❌ Unauthorized" });
    try {
      const API_KEY = process.env.REAL_DEBRID_API_KEY;
      // Select the specific file requested by the user
      await axios.post(`https://api.real-debrid.com/rest/1.0/torrents/selectFiles/${torrentId}`, new URLSearchParams({ files: fileId }), { headers: { Authorization: `Bearer ${API_KEY}` } });

      for (let i = 0; i < 15; i++) {
        const info = await axios.get(`https://api.real-debrid.com/rest/1.0/torrents/info/${torrentId}`, { headers: { Authorization: `Bearer ${API_KEY}` } });
        if (info.data.status === "downloaded" && info.data.links && info.data.links.length > 0) {
          const unrestrict = await axios.post("https://api.real-debrid.com/rest/1.0/unrestrict/link", new URLSearchParams({ link: info.data.links[0] }), { headers: { Authorization: `Bearer ${API_KEY}` } });
          return res.json({ downloadUrl: unrestrict.data.download });
        }
        await new Promise(r => setTimeout(r, 2000));
      }
      return res.status(408).json({ message: "⏳ Torrent is taking too long to cache/download." });
    } catch (error) {
      console.error(error.response?.data || error.message);
      return res.status(500).json({ message: "Error generating link from Real-Debrid" });
    }
  }

  if (service === "torbox") {
    try {
      const API_KEY = process.env.TORBOX_API_KEY;
      for (let i = 0; i < 15; i++) {
        try {
          // Request the precise file ID
          const dlRes = await axios.get(`https://api.torbox.app/v1/api/torrents/requestdl?token=${API_KEY}&torrent_id=${torrentId}&file_id=${fileId}`);
          if (dlRes.data.success && dlRes.data.data) {
            return res.json({ downloadUrl: dlRes.data.data });
          }
        } catch (e) {
          // Torbox throws a 400/500 if the torrent is still downloading internally
        }
        await new Promise(r => setTimeout(r, 2000));
      }
      return res.status(408).json({ message: "⏳ Torrent is taking too long to cache/download." });
    } catch (error) {
      console.error(error.response?.data || error.message);
      return res.status(500).json({ message: "Error generating link from Torbox" });
    }
  }
});

// 🎬 DEFAULT CATALOG
app.get("/catalog", async (req, res) => {
  try {
    console.log("🎬 Fetching default catalog...");
    const [movieRes, seriesRes] = await Promise.all([
      axios.get("https://v3-cinemeta.strem.io/catalog/movie/top.json"),
      axios.get("https://v3-cinemeta.strem.io/catalog/series/top.json"),
    ]);

    res.json({
      movies: movieRes.data?.metas || [],
      series: seriesRes.data?.metas || [],
    });
  } catch (error) {
    console.error("CATALOG ERROR:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch catalog" });
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

// 🔐 VERIFY REAL-DEBRID ACCESS
app.post("/verify-rd", (req, res) => {
  const { code } = req.body;

  if (code === process.env.RD_ADMIN_CODE) {
    return res.json({ success: true });
  }

  res.status(403).json({ success: false, message: "❌ Only admin can access Real-Debrid" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
