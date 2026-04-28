For example purpose only 

# 🚀 Torrent Search + Debrid Streaming App

A full-stack MERN-based streaming and torrent search system inspired by Stremio.
This app allows users to search movies/series, explore episodes, fetch torrents, and download via Real-Debrid — all in one place.

---

## 📌 Features

* 🔍 Search movies & series by name
* 🎬 Poster-based browsing (Cinemeta)
* 📺 Series navigation (Seasons → Episodes)
* ⚡ Torrent streaming via Torrentio
* 🧲 Torrent search with Jackett (seeders + size)
* 🚀 Download via Real-Debrid
* 🔁 Auto search with debounce
* 🔙 State-based navigation (no routing needed)
* 🎯 IMDb direct search mode

---

## 🧠 System Architecture

Frontend → Backend → External APIs

* Frontend (React)
* Backend (Node.js + Express)
* APIs:

  * Cinemeta → content discovery & metadata
  * Torrentio → streaming sources
  * Jackett → torrent search engine
  * Real-Debrid → download & link unrestriction

---

## 🔄 User Flow

Search → Select → Navigate → Stream/Download

1. User searches a movie/series
2. Posters are fetched from Cinemeta
3. User selects content
4. If series → choose season → choose episode
5. Streams fetched via Torrentio or Jackett
6. User can:

   * Copy magnet link
   * Download via Real-Debrid

---

## ⚙️ Backend APIs

* `/search-content` → Cinemeta search
* `/series-meta` → Series seasons & episodes
* `/torrentio-search` → Torrentio streams
* `/search` → Jackett torrents
* `/download` → Real-Debrid download

---

## 🧠 Tech Stack

* Frontend: React (Vite)
* Backend: Node.js, Express
* APIs: Cinemeta, Torrentio, Jackett, Real-Debrid
* State Management: React Hooks

---

## 🔐 Environment Variables

Create a `.env` file in backend:

```
REAL_DEBRID_API_KEY=your_key_here
JACKETT_API_KEY=your_key_here
PORT=5000
```

---

## 🚀 Getting Started

### 1. Clone the repo

```
git clone https://github.com/your-username/your-repo.git
cd your-repo
```

### 2. Backend setup

```
cd backend
npm install
npm run dev
```

### 3. Frontend setup

```
cd frontend
npm install
npm run dev
```

---

## 🎯 Current Features

✔ Movie + Series search
✔ Episode navigation
✔ Torrent streaming
✔ Jackett integration
✔ Real-Debrid download
✔ IMDb mode
✔ Auto search

---

## ⚠️ Limitations

* Torrentio does not provide size/seeders
* Cinemeta has limited metadata
* No built-in video player yet
* No caching (every request hits API)

---

## 🚀 Future Improvements

* 🎨 Netflix-style UI
* 🎥 Built-in video player
* 🧠 Merge Jackett + Torrentio results
* ⚡ Caching for faster performance
* 👤 Authentication & watchlist
* 📊 Smart torrent ranking

---

## 🏁 Project Level

Intermediate → Advanced Full Stack Project

---

## 💡 Key Learnings

* API chaining (Cinemeta → Torrentio → Real-Debrid)
* Async handling & debouncing
* State-driven navigation
* Backend API aggregation
* Real-world system design

---

## 📌 Note

This project is for educational purposes.
Make sure to comply with local laws when using torrent-related services.

---

## ⭐ Support

If you like this project, give it a star ⭐

