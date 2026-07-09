# Graph Report - C:\Users\veerk\OneDrive\Desktop\Project\Torrent  (2026-07-09)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 421 nodes · 859 edges · 24 communities (18 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.55)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `294f0494`
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

## God Nodes (most connected - your core abstractions)
1. `useSettingsContext()` - 34 edges
2. `ProductionSyncQueue` - 24 edges
3. `SyncHealthMonitor` - 23 edges
4. `PlaybackEventHandler` - 21 edges
5. `CrossDeviceSync` - 21 edges
6. `SyncTelemetry` - 20 edges
7. `SyncQueueService` - 19 edges
8. `ContinueWatchingAggregator` - 19 edges
9. `useAppContext()` - 18 edges
10. `useStreamActions()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `SettingsModal()` --calls--> `useSettingsContext()`  [EXTRACTED]
  frontend/src/components/modals/SettingsModal.jsx → frontend/src/context/SettingsContext.jsx
- `Layout()` --calls--> `usePlayerContext()`  [EXTRACTED]
  frontend/src/app/Layout.jsx → frontend/src/context/PlayerContext.jsx
- `ContinueWatchingCard()` --calls--> `useSettingsContext()`  [EXTRACTED]
  frontend/src/components/cards/ContinueWatchingCard.jsx → frontend/src/context/SettingsContext.jsx
- `ContinueWatchingCard()` --calls--> `fetchMeta()`  [EXTRACTED]
  frontend/src/components/cards/ContinueWatchingCard.jsx → frontend/src/services/cinemeta.js
- `EpisodeCard()` --calls--> `useSettingsContext()`  [EXTRACTED]
  frontend/src/components/cards/EpisodeCard.jsx → frontend/src/context/SettingsContext.jsx

## Import Cycles
- None detected.

## Communities (24 total, 6 thin omitted)

### Community 0 - "ContinueWatchingAggregator"
Cohesion: 0.08
Nodes (10): ContinueWatchingAggregator, PLAYBACK_STATES, TraktStateManager, getProductionSyncQueue(), getProvider(), getSyncMode(), queueTraktSync(), localProvider (+2 more)

### Community 1 - "useStreamActions.js"
Cohesion: 0.12
Nodes (22): ResultCard(), actionButtonStyle, ConvertLinkSection(), textareaStyle, FileSelectorModal(), VideoPlayer(), PlayerContext, usePlayerContext() (+14 more)

### Community 2 - "useSettingsContext"
Cohesion: 0.14
Nodes (23): Layout(), SettingsModal, VideoPlayer, Header(), SearchBar(), SettingsButton(), CatalogContext, MediaContext (+15 more)

### Community 3 - "cinemeta.js"
Cohesion: 0.15
Nodes (21): EpisodeCard(), Loader(), useSeasonScroll(), MoviePage(), gridItemVariants, gridVariants, SeriesPage(), encodePathPart() (+13 more)

### Community 4 - "SyncTelemetry"
Cohesion: 0.12
Nodes (3): SyncTelemetry, ConflictResolver, STORAGE_KEYS

### Community 5 - "dependencies"
Cohesion: 0.09
Nodes (15): dependencies, @fontsource-variable/inter, framer-motion, lucide-react, qrcode.react, react, react-dom, react-router-dom (+7 more)

### Community 8 - "devDependencies"
Cohesion: 0.09
Nodes (21): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, tailwindcss, @tailwindcss/vite (+13 more)

### Community 9 - "SyncQueueService"
Cohesion: 0.19
Nodes (4): AppProvider(), PlayerProvider(), STORAGE_KEYS, SyncQueueService

### Community 10 - "SettingsContext.jsx"
Cohesion: 0.17
Nodes (12): SettingsModal(), TABS, TraktSyncToggle(), SettingsContext, SettingsProvider(), useSyncStatus(), storageService, traktApi (+4 more)

### Community 13 - "progressTracker.js"
Cohesion: 0.29
Nodes (12): ContinueWatchingCard(), PosterCard(), checkSeriesCompletion(), cleanupStorage(), getContinueWatching(), getEpisodeProgress(), getMovieProgress(), getStorage() (+4 more)

### Community 14 - "package.json"
Cohesion: 0.12
Nodes (16): author, dependencies, axios, cors, dotenv, express, description, keywords (+8 more)

### Community 15 - "index.js"
Cohesion: 0.31
Nodes (7): allowedOrigins, app, curlPost(), curlRequest(), execFileAsync, getTraktConfig(), getTraktHeaders()

### Community 16 - "run.js"
Cohesion: 0.25
Nodes (5): backend, frontend, path, readline, { spawn }

### Community 17 - "package.json"
Cohesion: 0.29
Nodes (6): description, name, scripts, dev, start, version

## Knowledge Gaps
- **78 isolated node(s):** `app`, `allowedOrigins`, `name`, `version`, `description` (+73 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SyncHealthMonitor` connect `SyncHealthMonitor` to `ContinueWatchingAggregator`, `SettingsContext.jsx`, `SyncTelemetry`?**
  _High betweenness centrality (0.129) - this node is a cross-community bridge._
- **Why does `getProductionSyncQueue()` connect `ContinueWatchingAggregator` to `SyncTelemetry`?**
  _High betweenness centrality (0.126) - this node is a cross-community bridge._
- **Why does `Providers()` connect `dependencies` to `SyncQueueService`?**
  _High betweenness centrality (0.116) - this node is a cross-community bridge._
- **What connects `app`, `allowedOrigins`, `name` to the rest of the system?**
  _79 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ContinueWatchingAggregator` be split into smaller, more focused modules?**
  _Cohesion score 0.07575757575757576 - nodes in this community are weakly interconnected._
- **Should `useStreamActions.js` be split into smaller, more focused modules?**
  _Cohesion score 0.12233285917496443 - nodes in this community are weakly interconnected._
- **Should `useSettingsContext` be split into smaller, more focused modules?**
  _Cohesion score 0.13781512605042018 - nodes in this community are weakly interconnected._