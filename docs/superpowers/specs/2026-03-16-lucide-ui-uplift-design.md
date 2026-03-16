# Lucide UI Uplift — Design Spec

## Context

The Ancient Rome investigation platform has a functional but visually inconsistent UI. Map overlays use inline styles with mixed patterns (emoji icons, Unicode arrows, inline SVGs). The interface has almost no mobile/responsive support — MapControls, TimelinePlayer, FilterPanel, and TopBar break on small screens. This uplift delivers a cohesive Lucide-based aesthetic across all non-map-canvas UI, plus comprehensive responsive design.

**Constraint**: The Leaflet MapContainer, TileLayer, and all map layer components (TerritoryLayer, RoadLayer, etc.) must not be modified. Only the UI chrome around and on top of the map is in scope.

**Style Reference**: SlopeStyle ski rental app — clean Lucide icons, rounded-xl cards with hover shadows, pill-shaped filters (rounded-full), glassmorphism navbar, generous spacing (p-5/p-6), gradient text for branding, overlaid type badges on cards, smooth transitions. All adapted for dark theme.

## Scope

### In Scope

- LandingPage (`src/features/landing/LandingPage.tsx`)
- TopBar (`src/features/board/TopBar.tsx`)
- LensSwitcher (`src/features/board/LensSwitcher.tsx`)
- TrailBar (`src/features/board/TrailBar.tsx`)
- InvestigationBoard (`src/features/board/InvestigationBoard.tsx`)
- MapControls (`src/features/map/MapControls.tsx`) — rewrite as sheet/drawer
- SettlementLegend (`src/features/map/SettlementLegend.tsx`)
- EmperorBanner (`src/features/map/EmperorBanner.tsx`)
- StatsOverlay (`src/features/map/StatsOverlay.tsx`)
- TimelinePlayer (`src/features/timeline/TimelinePlayer.tsx`)
- DetailPanel (`src/features/detail/DetailPanel.tsx`)
- EntityHeader (`src/features/detail/EntityHeader.tsx`)
- ConnectionList (`src/features/detail/ConnectionList.tsx`)
- SourceLinks (`src/features/detail/SourceLinks.tsx`)
- FilterPanel (`src/features/filters/FilterPanel.tsx`)
- SearchBar (`src/features/search/SearchBar.tsx`)
- NarrationBar (`src/features/stories/NarrationBar.tsx`)
- CSS theme (`src/index.css`)

### Out of Scope

- MapContainer, TileLayer, BasePane, MapNavHandler
- All map layer components (TerritoryLayer, RoadLayer, SettlementLayer, etc.)
- EntityMarkers
- Leaflet CSS overrides (tooltips, popups, province labels)
- Graph, Timeline, and Stats view internals
- Data layer, stores, types

## Design

### 1. Icon Vocabulary

Replace all non-Lucide icons with Lucide equivalents. Establish a consistent entity-type icon map:

```
person       → User
organization → Building2
event        → CalendarDays
location     → MapPin
document     → FileText
legion       → Shield
dynasty      → Crown
religion     → Church
trade-good   → Package
infrastructure → Wrench
```

Component-specific replacements:

| Component                 | Current                            | Lucide Replacement                         |
| ------------------------- | ---------------------------------- | ------------------------------------------ |
| LensSwitcher labels       | Text only "Map"/"Graph"/"Timeline" | `Map`, `Network`, `Clock` + text           |
| TimelinePlayer play/pause | Inline `<svg>`                     | `Play`, `Pause`                            |
| TimelinePlayer speed      | Plain text                         | `Gauge` icon label                         |
| StatsOverlay              | Emoji ⚔🦅⚓🏛                      | `Swords`, `Bird`, `Anchor`, `Landmark`     |
| MapControls group arrows  | Unicode ▶▼                         | `ChevronRight`/`ChevronDown`               |
| MapControls layer icons   | None                               | Per-category icons (see Layer Icons below) |
| SettlementLegend collapse | Unicode ▶▼                         | `ChevronRight`/`ChevronDown`               |
| LandingPage CTA           | Text only                          | `ArrowRight`                               |
| LandingPage sections      | Text headings                      | `Compass`, `Star`, `BookOpen`              |
| DetailPanel sections      | Text only                          | `Network`, `Link`, `BookMarked`            |
| FilterPanel sections      | Text only                          | `Filter`, `Users`, `Link2`, `Calendar`     |
| TrailBar                  | Plain badges                       | `History` icon + entity-type color dots    |

**Layer category icons** (for MapControls groups):

```
Boundaries   → Globe
Transport    → Route
Military     → Swords
Economy      → Coins
Culture      → Landmark
Points       → MapPin
```

### 2. MapControls → Layer Sheet

**Current**: 160px absolute div, top-right, inline styles, Unicode arrows.

**New**: Collapsible sheet panel from right edge.

Desktop:

- Toggle button: `Layers` icon (size-8, ghost variant), top-right of map, z-1000
- Panel: 260px wide, absolute right-0 top-0, full height of map area
- Background: `bg-[#0f0a1a]/92 backdrop-blur-md`
- Border: `border-l border-white/10`
- Header: "Layers" title + `X` close button
- Presets section: horizontal pills with active state (amber accent)
- Layer groups: collapsible with category Lucide icon + `ChevronDown`/`ChevronRight`
- Layer toggles: refined with active color dot + cleaner toggle styling
- Settlement type submenu: unchanged structurally, refined visually

Mobile:

- Same `Layers` toggle button
- Opens as bottom Drawer (vaul) instead of side panel
- Max-height 60vh, full-width, scrollable
- Uses existing `Drawer`/`DrawerContent` from `src/ui/drawer.tsx`

### 3. SlopeStyle Design System (Dark-Adapted)

Adopt the following patterns from the SlopeStyle reference, translated to dark theme:

**Glassmorphism surfaces** (navbar, panels, overlays):

```
bg-[#0f0a1a]/80 backdrop-blur-md border border-white/10 rounded-xl shadow-lg
```

**Cards** (entity cards, story cards, connection items):

```
bg-bg-card rounded-xl border border-border hover:shadow-xl hover:shadow-black/20 transition-all duration-300
```

**Pill filters** (LensSwitcher, layer type filters, presets):

```
Active:   rounded-full bg-accent-gold text-black font-medium shadow-lg shadow-accent-gold/20
Inactive: rounded-full bg-bg-card text-text-secondary border border-border hover:bg-bg-secondary
```

**Branded logo** (TopBar):

- Small gold square with a Lucide `Shield` icon (like SlopeStyle's blue Snowflake square)
- "Ancient Rome" in gradient text: `bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-amber-600`

**Search input** (SlopeStyle style):

```
rounded-full bg-bg-card border border-border px-4 py-1.5 focus-within:border-accent-gold focus-within:ring-2 focus-within:ring-accent-gold/20
```

**Type badges on cards** (overlaid, like SlopeStyle's "Pro" badge):

```
absolute top-3 left-3 bg-[#0f0a1a]/90 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider
```

**Generous spacing**: Upgrade from p-4/gap-3 to p-5/gap-4 on cards, p-6 on major panels.

**Hover image zoom** on LandingPage cards:

```
overflow-hidden group → img: transform group-hover:scale-110 transition-transform duration-500
```

Apply glassmorphism to: EmperorBanner, SettlementLegend, StatsOverlay, MapControls trigger button, TopBar.

SettlementLegend: migrate from inline styles to Tailwind classes.

### 4. TopBar Refinements (SlopeStyle Nav Pattern)

Desktop (>768px):

- Height: `h-16` (from h-12) — matches SlopeStyle's generous nav height
- Glassmorphism: `bg-[#0f0a1a]/80 backdrop-blur-md border-b border-white/10`
- Logo area: Gold square (`bg-accent-gold p-1.5 rounded-lg`) with `Shield` icon + gradient "Ancient Rome" text
- SearchBar: `rounded-full bg-bg-card border border-border px-4`, wider (`w-64`), with `Search` icon and `⌘K` badge
- LensSwitcher: pill-shaped buttons (`rounded-full`), icon+text, active state with gold background
- Stories button: styled consistently with pill aesthetic

Mobile (<768px):

- Height: `h-14` (compact but still generous)
- Logo: gold icon only, hide text
- SearchBar: icon-only trigger → full-width overlay on tap
- LensSwitcher: icons only (`rounded-full` pills), `min-h-[44px]` touch targets
- Stories button: icon only

### 5. DetailPanel Polish

- Section headers: add Lucide icon before text
  - Ego radar section: `Network` icon
  - Connections section: `Link` icon
  - Sources section: `BookMarked` icon
- Dividers: use `Separator` component from `src/ui/separator.tsx` (already exists)
- EntityHeader type badge: include entity-type Lucide icon (from icon map above)
- No structural changes to drawer/sidebar behavior (already works well)

### 6. TrailBar Enhancement

- Add `History` icon (Lucide) at the left edge
- Each badge: add entity-type color dot (lookup entity from store to get type)
- Mobile: `min-h-[44px]`, larger badge touch targets, ensure horizontal scroll works

### 7. LandingPage Uplift (SlopeStyle Product Card Pattern)

- Hero: add `Compass` icon (size-12, text-accent-gold/60) above the title
- CTA button: `rounded-lg bg-accent-gold/10 border border-accent-gold` + `ArrowRight` icon + `active:scale-95` press effect
- "Featured Entities" heading: `Star` icon (size-5)
- "Guided Stories" heading: `BookOpen` icon (size-5)
- **Entity cards** (SlopeStyle ProductCard pattern):
  - `rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-border`
  - Entity type badge overlaid at top-left: `absolute top-3 left-3 bg-[#0f0a1a]/90 backdrop-blur-sm rounded-md` with entity-type Lucide icon
  - Connection count badge at top-right (like SlopeStyle's Pro badge)
  - Generous padding: `p-5`
  - Entity name: `font-bold text-lg`
  - Description: `text-sm text-text-secondary line-clamp-2`
  - Bottom row: entity type pill + "Investigate →" link
- **Story cards**: Same card pattern, `Footprints` icon next to step count, hover `group-hover:scale-105` subtle zoom
- Pill-shaped filter bar for entity types (like SlopeStyle's type filters): `rounded-full` buttons with active gold state

### 8. TimelinePlayer

Desktop:

- Replace inline SVG play/pause with Lucide `Play`/`Pause` (size-4)
- Play button: use `Button` component (variant ghost, size icon)
- Speed buttons: use `Button` component (variant ghost/default, size xs)
- Add `Gauge` icon label before speed pills

Mobile:

- Play button: `min-w-[44px] min-h-[44px]`
- Speed: show current speed only, tap to cycle through speeds
- Slider: larger thumb (via CSS `accent-color` + `appearance` overrides)
- Era label: hidden on mobile to save space

### 9. Responsive Design

**Breakpoint strategy**: Mobile-first with `sm:` (640px), `md:` (768px), `lg:` (1024px).

| Component        | < 768px (Mobile)                      | 768-1024px (Tablet)        | > 1024px (Desktop)         |
| ---------------- | ------------------------------------- | -------------------------- | -------------------------- |
| TopBar           | h-12, icons only, search icon trigger | h-14, partial labels       | h-14, full layout          |
| LensSwitcher     | Icons only, no text                   | Icons + short labels       | Icons + full labels        |
| SearchBar        | Icon → fullscreen overlay             | w-56 inline                | w-64 inline                |
| MapControls      | Bottom drawer (vaul)                  | Right panel 240px          | Right panel 260px          |
| SettlementLegend | Collapsed by default, smaller         | Normal                     | Normal                     |
| EmperorBanner    | Name only, smaller padding            | Name + dynasty             | Full: name, dynasty, dates |
| StatsOverlay     | 2x2 grid, smaller text                | Inline row                 | Inline row                 |
| TimelinePlayer   | 44px buttons, tap-cycle speed         | Normal with larger targets | Full layout                |
| FilterPanel      | Bottom drawer                         | 240px sidebar              | 280px sidebar              |
| TrailBar         | 44px height, scroll, small badges     | Normal                     | Normal                     |
| DetailPanel      | Bottom drawer (already works)         | 300px sidebar              | 340px sidebar              |
| NarrationBar     | Stacked (already responsive)          | Inline                     | Inline                     |

**Touch targets**: Every interactive element on mobile: `min-h-[44px] min-w-[44px]`.

**SearchBar mobile overlay**: On mobile, tapping the search icon opens a fixed overlay (`fixed inset-x-0 top-0 z-[1100]`) with a full-width input and results list below it. Close with `X` button or outside tap.

### 10. FilterPanel Mobile

Currently only visible when `sidebarOpen && lens === 'graph'`. On mobile:

- Replace sidebar with bottom Drawer
- Triggered by existing sidebar toggle button (PanelLeft) in TopBar
- Uses existing `Drawer`/`DrawerContent` components
- Add `isMobile` check in InvestigationBoard to switch rendering

## Files Modified

| File                                        | Change Type                                      |
| ------------------------------------------- | ------------------------------------------------ |
| `src/index.css`                             | Add glass utility, range slider thumb styles     |
| `src/features/board/TopBar.tsx`             | Height, icons, responsive classes, search mobile |
| `src/features/board/LensSwitcher.tsx`       | Icon+text buttons, responsive                    |
| `src/features/board/TrailBar.tsx`           | History icon, color dots, touch targets          |
| `src/features/board/InvestigationBoard.tsx` | Mobile FilterPanel as drawer                     |
| `src/features/map/MapControls.tsx`          | Full rewrite as sheet/drawer                     |
| `src/features/map/SettlementLegend.tsx`     | Tailwind migration, glassmorphism, icons         |
| `src/features/map/EmperorBanner.tsx`        | Glassmorphism upgrade, responsive                |
| `src/features/map/StatsOverlay.tsx`         | Lucide icons, responsive grid                    |
| `src/features/timeline/TimelinePlayer.tsx`  | Lucide icons, Button components, responsive      |
| `src/features/detail/DetailPanel.tsx`       | Section icons                                    |
| `src/features/detail/EntityHeader.tsx`      | Entity-type Lucide icon in badge                 |
| `src/features/detail/ConnectionList.tsx`    | Section icon                                     |
| `src/features/detail/SourceLinks.tsx`       | Section icon                                     |
| `src/features/filters/FilterPanel.tsx`      | Section icons, mobile drawer                     |
| `src/features/search/SearchBar.tsx`         | Keyboard hint, mobile overlay                    |
| `src/features/stories/NarrationBar.tsx`     | Touch target refinement                          |
| `src/features/landing/LandingPage.tsx`      | Icons, hover effects, touch targets              |
| `src/lib/colors.ts`                         | Add entity-type icon map export                  |

## New Dependencies

None. Everything uses existing: `lucide-react`, `vaul` (Drawer), Tailwind, shadcn components.

## Entity-Type Icon Map (new export in `src/lib/colors.ts`)

```typescript
import {
  User,
  Building2,
  CalendarDays,
  MapPin,
  FileText,
  Shield,
  Crown,
  Church,
  Package,
  Wrench,
} from 'lucide-react'

export const entityIcons: Record<string, typeof User> = {
  person: User,
  organization: Building2,
  event: CalendarDays,
  location: MapPin,
  document: FileText,
  legion: Shield,
  dynasty: Crown,
  religion: Church,
  'trade-good': Package,
  infrastructure: Wrench,
}
```

## Verification

1. `npm run dev` — verify the app starts without errors
2. **Desktop (>1024px)**: Check TopBar, LensSwitcher, MapControls panel, all overlays, DetailPanel, FilterPanel, LandingPage
3. **Tablet (768-1024px)**: Verify intermediate responsive states
4. **Mobile (<768px)**:
   - TopBar collapses to icons
   - Search opens as full-width overlay
   - MapControls opens as bottom drawer
   - FilterPanel opens as bottom drawer
   - TimelinePlayer has 44px touch targets
   - DetailPanel uses drawer (already working)
   - All interactive elements meet 44px minimum
5. **Map integrity**: Verify all 30+ map layers still render, click popups work, tooltips appear, flyTo navigation works, timeline scrubbing updates layers
6. `npm run build` — verify production build succeeds
7. `npm run lint` — verify no lint errors
