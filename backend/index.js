import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import axios from "axios";
import fs from "fs";

dotenv.config();

const app = express();
const TRAKT_API = "https://api.trakt.tv";

const getTraktConfig = () => ({
  clientId: process.env.TRAKT_CLIENT_ID,
  clientSecret: process.env.TRAKT_CLIENT_SECRET,
});

const getTraktHeaders = () => {
  const { clientId } = getTraktConfig();

  return {
    "Content-Type": "application/json",
    "trakt-api-version": "2",
    "trakt-api-key": clientId,
  };
};

// app.use(cors({
//   origin: "https://torrent-gamma.vercel.app"
// }));

// app.use(cors());

// 🔒 Advanced CORS Configuration - Restricted to allowed origins
const allowedOrigins = [
  "https://torrent-gamma.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000"
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

const logToFile = (message) => {
  const timestamp = new Date().toISOString();
  fs.appendFile("downloads.log", `[${timestamp}] ${message}\n`, (err) => {
    if (err) console.error("Error writing to log file:", err);
  });
};

app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

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

app.post("/trakt/device/code", async (req, res) => {
  const { clientId } = getTraktConfig();

  if (!clientId) {
    return res.status(500).json({ message: "Trakt client ID is not configured" });
  }

  try {
    const response = await axios.post(
      `${TRAKT_API}/oauth/device/code`,
      { client_id: clientId },
      { headers: getTraktHeaders() }
    );

    return res.json(response.data);
  } catch (error) {
    console.error("Trakt device code error:", error.response?.data || error.message);
    return res.status(500).json({ message: "Failed to start Trakt device flow" });
  }
});

app.post("/trakt/device/token", async (req, res) => {
  const { code } = req.body;
  const { clientId, clientSecret } = getTraktConfig();

  if (!clientId || !clientSecret) {
    return res.status(500).json({ message: "Trakt OAuth is not configured" });
  }

  if (!code) {
    return res.status(400).json({ message: "Device code is required" });
  }

  try {
    const response = await axios.post(
      `${TRAKT_API}/oauth/device/token`,
      {
        code,
        client_id: clientId,
        client_secret: clientSecret,
      },
      { headers: getTraktHeaders() }
    );

    return res.json(response.data);
  } catch (error) {
    const status = error.response?.status || 500;
    const traktError = error.response?.data?.error;

    if (traktError === "authorization_pending") {
      return res.status(202).json({ pending: true });
    }

    console.error("Trakt device token error:", error.response?.data || error.message);
    return res.status(status).json({
      message: error.response?.data?.error_description || "Failed to complete Trakt device flow",
    });
  }
});

app.post("/trakt/oauth/token", async (req, res) => {
  const { refreshToken } = req.body;
  const { clientId, clientSecret } = getTraktConfig();

  if (!clientId || !clientSecret) {
    return res.status(500).json({ message: "Trakt OAuth is not configured" });
  }

  if (!refreshToken) {
    return res.status(400).json({ message: "Refresh token is required" });
  }

  try {
    const response = await axios.post(
      `${TRAKT_API}/oauth/token`,
      {
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: "urn:ietf:wg:oauth:2.0:oob",
        grant_type: "refresh_token",
      },
      { headers: { "Content-Type": "application/json" } }
    );

    return res.json(response.data);
  } catch (error) {
    console.error("Trakt refresh token error:", error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      message: error.response?.data?.error_description || "Failed to refresh Trakt token",
    });
  }
});

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
