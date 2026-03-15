# Ancient Rome — Interactive History Investigation Platform

**Date:** 2026-03-14
**Status:** Approved
**Based on:** Free Masons / The Hidden Network (existing project)

## Overview

A new, independent repository for an Ancient Rome version of "The Hidden Network" — an interactive investigation board for exploring Roman history through network graphs, maps, timelines, and guided stories. Same core concept (history as an interactive network graph where users uncover hidden connections), applied to Rome from 753 BC to 476 AD.

Built from scratch with architectural improvements learned from the existing Freemasonry project: Zustand for state management, Tailwind + shadcn/ui for styling, Zod-validated JSON data pipeline, and decomposed components (no file exceeds ~150 lines).

## Decisions

| Decision         | Choice                                          | Rationale                                                                          |
| ---------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------- |
| Scope            | Full domain model upfront, seed data for subset | Validates architecture handles Rome's complexity without blocking on content       |
| Era              | 753 BC – 476 AD                                 | Full arc: Kingdom → Republic → Empire → Fall                                       |
| Platform engine  | Soft separation                                 | Rome-specific content in clear directories, no premature abstraction               |
| State management | Zustand                                         | Lightweight, selector-based re-renders, hooks-compatible, eliminates prop drilling |
| Styling          | Tailwind CSS v4 + shadcn/ui                     | Utility-first styling + accessible component primitives (Drawer, Dialog, Tooltip)  |
| Data pipeline    | JSON + Zod schemas                              | Type-safe validation, single source of truth, pre-commit integrity checks          |
| Testing          | Vitest + React Testing Library                  | Component + unit tests, co-located test files                                      |
| Deployment       | Vercel                                          | Zero-config with Vite, preview deploys on PRs                                      |
| Architecture     | Hybrid feature modules + shared layer           | Features own their components; stores, types, and lib are shared                   |

## Tech Stack

- **Framework:** React 19 + TypeScript + Vite
- **State:** Zustand
- **Styling:** Tailwind CSS v4, shadcn/ui
- **Visualizations:** D3.js (graph, timeline, charts), Leaflet (map)
- **Search:** Fuse.js (fuzzy search)
- **Validation:** Zod
- **Testing:** Vitest, React Testing Library
- **Tooling:** ESLint 9 (flat config), Prettier, simple-git-hooks + lint-staged
- **Deployment:** Vercel
- **Analytics:** @vercel/analytics

## Data Model

### Entity Types (10)

All entities share a common base:

```typescript
interface EntityBase {
  id: string
  name: string
  entityType: EntityType // Zod literal union of the 10 known types
  description: string
  yearStart?: number
  yearEnd?: number
  region?: string
  sources: string[]
  imageUrl?: string
}
```

| Type               | Key Fields                           | Notes                                                      |
| ------------------ | ------------------------------------ | ---------------------------------------------------------- |
| **Person**         | born, died, roles[], faction         | Emperors, senators, generals, philosophers                 |
| **Organization**   | founded, dissolved, orgType          | Senate, legions, priesthoods, guilds, political factions   |
| **Event**          | date, endDate, eventType             | Battles, assassinations, laws, treaties, revolts           |
| **Location**       | locationType, coordinates, province  | Cities, provinces, forts, roads, harbors                   |
| **Document**       | date, author, docType                | Laws, treaties, speeches, literary works, inscriptions     |
| **Legion**         | founded, disbanded, symbol, homeBase | Roman legions with deployment history                      |
| **Dynasty**        | founder, startYear, endYear          | Julio-Claudian, Flavian, Nerva-Antonine, Severan           |
| **Religion**       | origin, deities[]                    | Roman pantheon, mystery cults, early Christianity, Judaism |
| **TradeGood**      | origins[], destinations[]            | Grain, wine, olive oil, silk, slaves, metals               |
| **Infrastructure** | builtBy, builtYear, infraType        | Roads, aqueducts, walls, forums, temples                   |

### Connection Types (~25)

```typescript
interface Connection {
  id: string
  source: string // Entity ID
  target: string // Entity ID
  connectionType: ConnectionType
  strength: 1 | 2 | 3
  year?: number
  endYear?: number
  evidence: string
  sources: string[]
}
```

**Political:** alliance, opposition, faction, succession, assassination, appointment
**Military:** commanded, served_in, battle_participation, campaign, defeated
**Social:** family, mentorship, patronage, rivalry, marriage
**Geographic:** located_in, governed, trade_route, military_route
**Cultural:** authored, dedicated_to, worship, built, founded

### Territorial Boundaries

Modeled as a geographic layer, not a graph entity type:

```typescript
interface TerritorySnapshot {
  id: string
  name: string
  year: number
  boundaries: GeoJSON.Feature
  controlledBy?: string // Entity ID
  status: 'core' | 'province' | 'client' | 'contested' | 'lost'
}
```

~15-20 snapshots at key historical dates (264 BC, 146 BC, 44 BC, 117 AD, 395 AD, 476 AD, etc.). The map snaps to the nearest snapshot as the timeline scrubs (no polygon morphing — geographic interpolation is non-trivial and deferred as a future enhancement).

## Directory Structure

```
src/
├── app/                  # App.tsx, routes, providers, layout
├── features/
│   ├── graph/            # GraphView, GraphControls, graph.utils
│   ├── map/              # MapView, EntityMarkers, TerritoryLayer, RouteOverlay, MapControls
│   ├── timeline/         # TimelineView, TimelineLane, EraOverlay, TimelinePlayer, era.utils
│   ├── detail/           # DetailPanel, EntityHeader, EgoRadar, ConnectionList, SourceLinks
│   ├── search/           # SearchBar, PathFinder
│   ├── stories/          # StoryPlayer, NarrationBar
│   ├── filters/          # FilterPanel, entity/connection/region/time filters
│   ├── stats/            # StatsView, SummaryCards, TopConnected, ChordDiagram, PowerRankings, etc.
│   └── landing/          # LandingPage, LandingOverlay
├── stores/               # Zustand stores
│   ├── useSelectionStore.ts
│   ├── useFilterStore.ts
│   ├── useUIStore.ts
│   └── useTimelineStore.ts
├── data/
│   ├── schemas/          # Zod schemas (person.ts, legion.ts, connection.ts, etc.)
│   ├── entities/         # JSON data files (people.json, events.json, etc.)
│   ├── territories/      # GeoJSON boundary snapshots
│   ├── stories/          # Guided story definitions
│   ├── loader.ts         # Load + validate all data
│   └── index.ts          # Public API: typed exports
├── ui/                   # shadcn components + custom primitives
├── lib/                  # pathfinding, geo, colors, analytics
└── types/                # Shared TypeScript types (inferred from Zod)
```

## Zustand Store Architecture

### useSelectionStore

- **State:** selectedId, hoveredId, breadcrumbs[], pinnedIds[]
- **Actions:** select(), hover(), pin(), unpin(), clearTrail()

### useFilterStore

- **State:** entityTypes[], connectionTypes[], regions[], yearRange, searchQuery
- **Actions:** setFilter(), resetFilters(), saveSnapshot(), restoreSnapshot()
- **Derived:** filteredEntities, filteredConnections (memoized selectors)

### useUIStore

- **State:** lens (graph | map | timeline | stats), detailPanelOpen, sidebarOpen, isMobile
- **Actions:** switchLens(), toggleDetail(), toggleSidebar()

### useTimelineStore

- **State:** playing, currentYear, speed, isScrubbing
- **Actions:** play(), pause(), setYear(), setSpeed()

No prop drilling. Components read/write directly: `useSelectionStore(s => s.selectedId)`. URL sync via Zustand `subscribe()`. Stories/guided mode orchestrates these stores rather than owning parallel state.

## Component Architecture

### InvestigationBoard (~80 lines)

Slim layout orchestrator. Composes TopBar, active lens, DetailPanel, TrailBar, NarrationBar. All state in stores.

### Feature Decomposition

**TimelineView** (current: 818 lines → 6 files):

- `TimelineView.tsx` (~120 lines) — orchestrator, scales, layout
- `TimelineLane.tsx` (~100 lines) — single lane for one entity type
- `EraOverlay.tsx` (~80 lines) — era detection + shaded regions
- `TimelinePlayer.tsx` (~60 lines) — play/pause/speed controls
- `TimelineTooltip.tsx` (~40 lines) — hover tooltip
- `era.utils.ts` (~80 lines) — era detection algorithm + scoring

**StatsView** (current: 668 lines → 8 files):

- `StatsView.tsx` (~60 lines) — dashboard grid layout only
- `SummaryCards.tsx`, `TopConnected.tsx`, `ConnectionDist.tsx`, `CenturyChart.tsx`, `RegionChart.tsx` (~50-80 lines each)
- `ChordDiagram.tsx` (~130 lines), `PowerRankings.tsx` (~150 lines)

**DetailPanel** (current: 377 lines → 5 files):

- `DetailPanel.tsx` (~80 lines) — layout + mobile sheet (shadcn Drawer)
- `EntityHeader.tsx` (~60 lines) — name, dates, type badge, pin button
- `EgoRadar.tsx` (~120 lines) — radial connection chart
- `ConnectionList.tsx` (~70 lines) — grouped connected entities
- `SourceLinks.tsx` (~30 lines) — Wikipedia + source references

**Principle:** No component exceeds ~150 lines. Orchestrators are layout-only.

### MapView Feature (5 files)

- `MapView.tsx` (~100 lines) — Leaflet container, layer management
- `EntityMarkers.tsx` (~80 lines) — clustered point markers
- `TerritoryLayer.tsx` (~120 lines) — GeoJSON polygons, temporal interpolation
- `RouteOverlay.tsx` (~80 lines) — campaign/trade/road polylines
- `MapControls.tsx` (~50 lines) — layer toggles

## Rome-Specific Features (Future)

Architecture supports these without new engines — they're compositions of existing primitives:

**Dynasty Trees** (`features/dynasty/`): D3 hierarchy layout from Person entities + family/succession/marriage connections. New lens or detail panel sub-view.

**Senate Network** (`features/senate/`): Filtered force-directed graph — Person entities with role "senator" + faction/alliance/opposition connections. Themed view of existing graph engine.

**Campaign Trails** (part of `features/map/`): Animated Leaflet polylines from ordered Location sequences + years. Syncs with timeline store.

**Parallel Timelines** (extension of `features/timeline/`): Multiple TimelineLane instances filtered by region/category. UI/filter concern, not architecture concern.

## Data Pipeline

### Validation Flow

1. Zod schemas define shape of every entity type, connection, and story
2. `loader.ts` imports JSON, validates against schemas, checks referential integrity
3. Validation runs at build time and via pre-commit hook (`validate-data` script)
4. TypeScript types inferred from Zod schemas — single source of truth

### Seed Data (v1)

- ~30-40 People (key emperors, senators, generals across all eras)
- ~10-15 Events (founding, Punic Wars, Caesar's assassination, fall of Rome)
- ~15-20 Locations (Rome, Carthage, Alexandria, key provinces)
- ~5 Organizations (Senate, Praetorian Guard, key legions)
- ~5 Documents (Twelve Tables, key speeches/laws)
- ~80-100 Connections
- 1-2 guided Stories (e.g., "The Fall of the Republic")
- 3-4 territory snapshots

## Testing Strategy

- **Schemas:** Zod validation accepts valid, rejects invalid data
- **Stores:** Zustand actions produce correct state transitions
- **Utils:** Pure functions — pathfinding, filtering, era detection
- **Data:** Referential integrity, no orphaned connections
- **Components:** Key interactions — click node → detail panel opens

Co-located test files: `PathFinder.tsx` + `PathFinder.test.tsx`.

## Dev Infrastructure

- ESLint 9 flat config + React/TypeScript rules
- Prettier for formatting
- simple-git-hooks + lint-staged for pre-commit (lint, format, validate data)
- GitHub Actions: lint + test + build on PR
- Vercel preview deploys on PR

## What Carries Over from Free Masons

**Kept as-is (concepts):** Multi-entity relational data model, typed/weighted/sourced connections, PathFinder (BFS shortest path), guided Stories system, lens architecture (graph/map/timeline/stats), investigation board UX, URL parameter persistence, breadcrumb trail + pinned entities.

**Improved:**

- State management: prop drilling → Zustand stores
- Component sizes: 800-line monoliths → ~150-line max, feature-organized
- Styling: plain CSS → Tailwind + shadcn/ui (scoped, accessible)
- Data validation: none → Zod schemas + pre-commit checks
- Testing: none → Vitest + RTL
- Mobile UX: custom drag logic → shadcn Drawer
- Type safety: separate types → Zod-inferred types (single source of truth)

**New for Rome:**

- Territorial boundary evolution (GeoJSON layers on map)
- Route overlays (military campaigns, trade routes, roads)
- Architecture for dynasty trees, senate networks, parallel timelines
- 10 entity types (vs 7) covering Rome's broader domain
