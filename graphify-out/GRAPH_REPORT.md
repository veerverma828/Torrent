# Graph Report - Torrent  (2026-07-09)

## Corpus Check
- 83 files · ~53,375 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 401 nodes · 791 edges · 25 communities (18 shown, 7 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.55)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `399106e3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ContinueWatchingAggregator
- useStreamActions.js
- useSettingsContext
- cinemeta.js
- SyncTelemetry
- dependencies
- CrossDeviceSync
- ProductionSyncQueue
- devDependencies
- SyncQueueService
- SettingsContext.jsx
- PlaybackEventHandler
- SyncHealthMonitor
- progressTracker.js
- package.json
- index.js
- run.js
- package.json
- vercel.json
- run.sh script
- graphify.md

## God Nodes (most connected - your core abstractions)
1. `useSettingsContext()` - 34 edges
2. `TraktSyncQueue` - 29 edges
3. `SyncHealthMonitor` - 23 edges
4. `PlaybackEventHandler` - 20 edges
5. `SyncTelemetry` - 20 edges
6. `useAppContext()` - 18 edges
7. `useStreamActions()` - 16 edges
8. `🚀 Torrent Search + Debrid Streaming App` - 15 edges
9. `🚀 Torrent Search + Debrid Streaming App` - 13 edges
10. `useSearch()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Layout()` --calls--> `usePlayerContext()`  [EXTRACTED]
  frontend/src/app/Layout.jsx → frontend/src/context/PlayerContext.jsx
- `Providers()` --calls--> `isTraktSyncEnabled()`  [EXTRACTED]
  frontend/src/app/providers.jsx → frontend/src/utils/syncMode.js
- `ContinueWatchingCard()` --calls--> `updateTrackingMetadata()`  [EXTRACTED]
  frontend/src/components/cards/ContinueWatchingCard.jsx → frontend/src/trackers/progressTracker.js
- `EpisodeCard()` --calls--> `useSettingsContext()`  [EXTRACTED]
  frontend/src/components/cards/EpisodeCard.jsx → frontend/src/context/SettingsContext.jsx
- `PosterCard()` --calls--> `useSettingsContext()`  [EXTRACTED]
  frontend/src/components/cards/PosterCard.jsx → frontend/src/context/SettingsContext.jsx

## Import Cycles
- None detected.

## Communities (25 total, 7 thin omitted)

### Community 1 - "useStreamActions.js"
Cohesion: 0.17
Nodes (19): ResultCard(), actionButtonStyle, ConvertLinkSection(), textareaStyle, FileSelectorModal(), usePlayerContext(), NOTE: intentionally NOT using useCallback so closures are always fresh., useStreamActions() (+11 more)

### Community 2 - "useSettingsContext"
Cohesion: 0.09
Nodes (30): Layout(), SettingsModal, VideoPlayer, ContinueWatchingCard(), Loader(), HeroBanner(), pickHeroCandidates(), MediaRail (+22 more)

### Community 3 - "cinemeta.js"
Cohesion: 0.16
Nodes (24): SearchBar(), useCatalogContext(), useSearchContext(), useSearch(), useSeasonScroll(), gridItemVariants, gridVariants, SeriesPage() (+16 more)

### Community 5 - "dependencies"
Cohesion: 0.09
Nodes (15): dependencies, @fontsource-variable/inter, framer-motion, lucide-react, qrcode.react, react, react-dom, react-router-dom (+7 more)

### Community 6 - "CrossDeviceSync"
Cohesion: 0.11
Nodes (18): 1. Clone the repo, 2. Backend setup, 3. Frontend setup, ⚙️ Backend APIs, 🎯 Current Features, 🔐 Environment Variables, 📌 Features, 🚀 Future Improvements (+10 more)

### Community 7 - "ProductionSyncQueue"
Cohesion: 0.12
Nodes (16): 1. Clone the repo, 2. Backend setup, 3. Frontend setup, ⚙️ Backend APIs, 🎯 Current Features, 🔐 Environment Variables, 📌 Features, 🚀 Future Improvements (+8 more)

### Community 8 - "devDependencies"
Cohesion: 0.09
Nodes (21): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, tailwindcss, @tailwindcss/vite (+13 more)

### Community 9 - "SyncQueueService"
Cohesion: 0.17
Nodes (8): VideoPlayer(), AppProvider(), CatalogContext, MediaContext, SearchContext, useMediaContext(), PlayerContext, PlayerProvider()

### Community 12 - "SyncHealthMonitor"
Cohesion: 0.06
Nodes (18): CrossDeviceSyncIndicator(), formatRelativeTime(), performInitialTraktSync(), TraktSyncToggle(), useSyncStatus(), useTraktWatchlist(), SyncHealthMonitor, traktApi (+10 more)

### Community 13 - "progressTracker.js"
Cohesion: 0.23
Nodes (15): EpisodeCard(), PosterCard(), applyMapped(), checkSeriesCompletion(), cleanupStorage(), getContinueWatching(), getEpisodeProgress(), getMovieProgress() (+7 more)

### Community 14 - "package.json"
Cohesion: 0.12
Nodes (16): author, dependencies, axios, cors, dotenv, express, description, keywords (+8 more)

### Community 15 - "index.js"
Cohesion: 0.40
Nodes (4): allowedOrigins, app, getTraktConfig(), getTraktHeaders()

### Community 16 - "run.js"
Cohesion: 0.25
Nodes (5): backend, frontend, path, readline, { spawn }

### Community 17 - "package.json"
Cohesion: 0.29
Nodes (6): description, name, scripts, dev, start, version

## Knowledge Gaps
- **106 isolated node(s):** `app`, `allowedOrigins`, `name`, `version`, `description` (+101 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Providers()` connect `dependencies` to `SyncQueueService`, `SyncHealthMonitor`?**
  _High betweenness centrality (0.106) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `devDependencies`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **What connects `app`, `allowedOrigins`, `name` to the rest of the system?**
  _107 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `useSettingsContext` be split into smaller, more focused modules?**
  _Cohesion score 0.08627450980392157 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `CrossDeviceSync` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `ProductionSyncQueue` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._