# Cinematic Dark Redesign — Design Spec

## Context

The Lucide UI uplift added consistent icons and basic responsive support, but the visual result still feels "generic Tailwind." This redesign adopts an editorial cinematic dark aesthetic inspired by a reference app — near-black surfaces, serif italic headings, ultra-subtle borders, amber glow effects, dramatic typography with wide letter-spacing, and generous whitespace. All Lucide icons are preserved.

**Constraint**: Map canvas, layer components, and all Lucide icon usage remain untouched. Only visual styling (colors, typography, spacing, shadows, borders, blur) changes.

## Design Tokens (CSS Theme Changes)

### Colors

| Token                    | Current   | New                                              |
| ------------------------ | --------- | ------------------------------------------------ |
| `--color-bg-primary`     | `#0f0a1a` | `#0a0a0c`                                        |
| `--color-bg-secondary`   | `#1a1425` | `#0c0c10`                                        |
| `--color-bg-card`        | `#231d30` | `rgba(255,255,255,0.03)` — use `bg-white/[0.03]` |
| `--color-border`         | `#3a3450` | `rgba(255,255,255,0.06)`                         |
| `--color-text-secondary` | `#a0a0b0` | `#64748b` (slate-500)                            |

### Typography

- Add `@fontsource-variable/playfair-display` or use `Georgia, 'Times New Roman', serif` as `--font-serif`
- Headings in detail panel, landing page hero, emperor banner: `font-serif italic`
- Labels/badges: `text-[10px] font-bold uppercase tracking-[0.2em]`
- Section dividers: label + `flex-1 h-px bg-white/5` line pattern

### Borders & Corners

- Default border: `border-white/[0.06]` (nearly invisible)
- Hover border: `border-white/[0.1]` or `border-amber-500/30`
- Default radius: `rounded-2xl` (16px) up from `rounded-xl` (12px)
- Pill buttons stay `rounded-full`

### Shadows & Glow

- Panel shadow: `shadow-[0_8px_32px_rgba(0,0,0,0.5)]`
- Amber button glow: `shadow-[0_4px_15px_rgba(180,83,9,0.3)]`
- Focus glow: `shadow-[0_0_0_3px_rgba(245,158,11,0.1),0_0_20px_rgba(245,158,11,0.08)]`
- Ambient spotlight: `radial-gradient(ellipse, rgba(245,158,11,0.03), transparent 60%)` behind hero/banner

### Blur & Glass

- Standard glass: `bg-black/70 backdrop-blur-xl` (was `bg-[#0f0a1a]/80 backdrop-blur-md`)
- Heavy glass (topbar, timeline): `bg-black/60 backdrop-blur-2xl`
- Surface cards: `bg-white/[0.03] border border-white/[0.05]` (no blur needed)

## Component Changes

### index.css

- Update all theme color variables
- Add `--font-serif: 'Playfair Display Variable', Georgia, serif`
- Add custom scrollbar: thin, `bg-white/10` thumb on `transparent` track
- Add timeline slider styling: gradient track, glow thumb
- Add ambient glow keyframe

### TopBar

- Background: `bg-black/60 backdrop-blur-2xl border-b border-white/[0.05]`
- Logo: gradient amber square (`bg-gradient-to-br from-amber-500 to-amber-700`) with serif italic "R" or Shield icon + serif italic "Ancient Rome" in `text-amber-500/70`
- Search: `bg-white/[0.04] border border-white/[0.06] rounded-xl` (not rounded-full)
- Lens pills: container `bg-black/50 border border-white/[0.06] rounded-xl p-1`, active `bg-amber-600 text-white rounded-[10px]`, inactive `text-slate-500`

### LensSwitcher

- Labels: `text-[10px] font-bold uppercase tracking-[0.15em]`
- Active: `bg-amber-600 text-white shadow-lg`
- Inactive: `text-slate-500 hover:text-white`

### SearchBar

- Wrapper: `bg-white/[0.04] border border-white/[0.06] rounded-xl` (desktop)
- Focus: `border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.08)]`
- Results dropdown: `bg-black/90 backdrop-blur-xl border-white/[0.06] rounded-xl`

### MapControls

- Toggle button: `bg-black/70 backdrop-blur-xl border border-white/[0.06] rounded-xl`
- Panel: `bg-[#0c0c10] border-l border-white/[0.05]` (solid dark, no blur needed)
- Preset pills: active `bg-amber-600`, inactive `text-slate-500`
- Layer toggles: active gets `border-l-2 border-amber-500` indicator, inactive `border-transparent`
- Group headers: `text-[10px] font-bold uppercase tracking-[0.15em] text-amber-500/50`

### SettlementLegend

- Background: `bg-black/70 backdrop-blur-xl border border-white/[0.05] rounded-2xl`

### EmperorBanner

- Glass: `bg-black/70 backdrop-blur-xl border border-white/[0.06] rounded-2xl`
- Name: `font-serif text-sm font-semibold`
- Sub-label: `text-[9px] uppercase tracking-[0.1em] text-slate-500`

### StatsOverlay

- Glass: `bg-black/70 backdrop-blur-xl border border-white/[0.05] rounded-2xl`
- Keep Lucide icons (Swords, Bird, Anchor, Landmark)
- Values: `font-semibold text-slate-100`, labels: `text-slate-500`

### TimelinePlayer

- Background: `bg-black/80 backdrop-blur-2xl border-t border-white/[0.05]`
- Play button: `bg-white/[0.05] rounded-full` with amber icon color
- Slider: CSS gradient track (`from-amber-600 to-amber-500`), glow thumb
- Speed pills: active `bg-amber-600 text-white rounded-lg`, `text-[9px] font-bold`
- Year display: `font-mono text-slate-400`

### DetailPanel

- Sidebar bg: `bg-[#0c0c10] border-l border-white/[0.05]`
- Entity name: `font-serif text-2xl italic` (dramatic sizing)
- Description: `italic border-l-2 border-amber-500/30 pl-4 text-slate-400`
- Stat grid: 2-col grid with `bg-white/[0.03] border border-white/[0.05] rounded-2xl` cards
- Labels in stat grid: `text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500`
- Values: `text-xl font-light text-slate-200`

### EntityHeader

- Type badge: `text-[10px] font-bold uppercase tracking-[0.2em]` with Lucide icon
- Badge bg: `bg-amber-500/10 border border-amber-500/20 text-amber-500`

### ConnectionList

- Section header: `text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/50` + divider line
- Items: `rounded-xl border border-transparent hover:bg-white/[0.03] hover:border-white/[0.05]` with chevron right
- Connection type: `text-[10px] text-slate-500`

### SourceLinks

- Same section header pattern as ConnectionList

### FilterPanel

- Labels: uppercase with wide tracking
- Surface cards for filter groups

### TrailBar

- Nearly invisible border: `border-t border-white/[0.05]`
- Badges: `bg-white/[0.03] border border-white/[0.05] rounded-xl`

### NarrationBar

- Glass: `bg-black/80 backdrop-blur-2xl border-t border-white/[0.05]`

### LandingPage

- Hero heading: `font-serif italic text-5xl md:text-7xl` with gradient amber text
- Ambient spotlight behind heading
- CTA: `bg-amber-600 hover:bg-amber-500 rounded-2xl shadow-[0_8px_30px_rgba(180,83,9,0.35)]` with `active:scale-[0.97]`
- Cards: `bg-white/[0.03] border border-white/[0.05] rounded-2xl hover:border-amber-500/20`
- Card headings: `font-serif italic`
- Section headers: uppercase tracking with divider line

## No New Dependencies

Use Georgia/Times as serif fallback. If we want Playfair Display, it's one `npm install @fontsource-variable/playfair-display`. Otherwise zero deps.

## Verification

1. `npm run dev` — no errors
2. Visual check: near-black bg, serif headings, amber glows, subtle borders
3. Map integrity: all layers, popups, tooltips still work
4. `npm run build` — passes
5. `npm run lint` — passes
