# Atlas of Ancient Rome — Design System

The codified house style. Every surface — map, chrome, dialogs, mobile — speaks
this one language. When adding UI, copy these recipes; when something looks
off, this document is the arbiter. Decisions here were settled in the July 2026
design sprints (Playwright-verified against the live plates) — don't relitigate
them casually.

## Voice

An atlas plate, not a dashboard. Dark room, parchment ink, amber instrument
lights. Typography carries the identity; boxes and borders stay quiet.

## Typography

| Role | Recipe |
|---|---|
| Display / titles | `var(--font-serif)` (Playfair Display), often italic — dialog titles, the year dial, popup titles |
| Map names (states) | Serif, uppercase, letter-spaced small-caps look — `.empire-label` tiers |
| Sea names | Serif *italic*, Latin (`Mare Internum`), `.sea-label` |
| UI labels / taxonomy | `text-[9px] uppercase tracking-[0.14em] text-slate-500` — stat labels, search categories, section headers |
| Body / facts | System sans, `text-xs`/`text-sm`, `text-slate-100..400` |
| Numbers | `tabular-nums`, `font-semibold`, `text-amber-50` next to their small-caps label |

**Hierarchy on the map comes from SIZE, not color.** Empire-name tiers:
11px / 14px / 17px (`.empire-label`, `--large`, `--vast`) in uniform parchment
ink `#ead9b0` → `#f3e6c4`. Rome's own name warms to `#f4d9c0` and its imperial
crimson family is exclusive to the territory layer.

## Color

- **House dark**: `#0a0a0c` (panels), `bg-black/95` (dropdowns), page-black header.
- **Amber accents** (`amber-500` family): active states, focus rings, the
  timeline instrument, city dots. Glow, never fill: `border-amber-500/25`,
  `bg-amber-500/10`, `shadow-[0_0_20px_rgba(245,158,11,0.08)]`.
- **Parchment ink**: `#f3e9d6` (popup titles), `#fde8c0` (city labels),
  `#ead9b0` (state names), `#d9cdb4` (minor names).
- **Polity fills**: the 16-color earth/mineral `POLITY_PALETTE`
  (EmpiresLayer) — ochre/moss/terracotta family, hashed stably by polity name.
  Vassals wear their suzerain's hue with a ±lightness member shade.
  Borders are each polity's own color at ~58% brightness.
- **Muted status colors**: errors `bg-red-950/90 text-red-200`; success is
  parchment, NOT green (the SOURCES chip precedent).

## Materials

One glass recipe for floating chrome (stats bar, legend, controls):

```
bg-[#0a0a0c]/85 backdrop-blur-md border border-white/[0.08] rounded-xl
shadow-[0_4px_24px_rgba(0,0,0,0.5)]
```

Dropdowns/dialogs sit heavier: `bg-black/95` (search) or solid `#0a0a0c`
with `border-white/[0.06]` and `shadow-[0_8px_32px_rgba(0,0,0,0.5)]`.
Radii: `rounded-xl` for panels/inputs, `rounded-full` for chips/pills.
Buttons are ghosts: bordered amber text (START buttons), never filled slabs.

## Map plate rules (the cartography)

- **Political wash**: fill panes at `0.55` group opacity through z7, easing to
  a `0.3` tint by z10 (MapView `BasePane`) — city zooms read terrain and
  monuments, while the tint still veils the modern urban footprint in the
  raster tiles.
- **Coastlines**: all polity shapes are clipped to Natural Earth land buffered
  +0.01° seaward (build pipeline, `clip-to-land.py`); the polity border line
  doubles as coastline ink.
- **Label declutter is one system**: Web-Mercator screen-space math in
  `layers/labelCollision.ts` ONLY — never `lat*pxPerDeg` or `cos(lat)`
  x-scaling. Label widths from `labelHalfWidth()` (kept within ~2% of DOM).
- **Imperial anchors**: Rome/Byzantium name themselves era-aware from ONE
  module, `layers/imperialAnchors.ts`, seeded as pre-placed labels in every
  layer's declutter. If a plate looks wrong, tune the anchor lng — not the CSS.
- **City-dodge obstacles**: only cities that ACTUALLY print a label
  (`popAt(populations, year) >= labelMinPop(zoom)`, shared
  `populationCurve.ts`). Never a static all-cities registry — phantom
  obstacles scatter names (the Burgundy-onto-Paris incident, 2026-07-10).
- **Dot discipline**: below z6 only label-grade cities render; monuments carry
  `minZoom` in `datasetRegistry`; gazetteer-only nodes render 1px smaller at
  0.45 opacity as texture.
- **divIcon labels** need `width: max-content` or `translateX(-50%)` silently
  no-ops (0-width wrapper) and every name renders left-edge-at-anchor.
- **Vignette**: one radial edge shadow overlay — felt, not seen.

## Interaction

- Focus: house amber `:focus-visible` ring, never browser blue.
- Popups: serif title, sans fact line, ghost "Read more"; one shared popup
  instance per layer (imperative Leaflet pattern).
- All HTML sinks that render external names go through `esc()` — wiki-sourced
  strings are a stored-XSS surface.
- Reduced motion: pulsing affordances (play nudge) become static.

## Adding a surface — checklist

1. Panel material = the glass recipe; title serif (italic for dialog titles).
2. Labels small-caps slate; values tabular amber-tinted.
3. Actions = ghost amber buttons or amber-tinted chips.
4. Names from data → `esc()`.
5. New map label class → serif, parchment ink, `width: max-content`,
   declutter through `labelCollision.ts`.
6. Shoot it with the rig before shipping (`?year=&lat=&lng=&z=&layers=` +
   `localStorage['atlas-layers-v1']`); verify at 1680×950 and 390×844.
