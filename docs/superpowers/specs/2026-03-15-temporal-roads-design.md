# Temporal Road Development — Design Spec

## Overview

Animate the Roman road network growing over time as the user scrubs the timeline, rather than showing all roads as a static layer. Roads appear when their surrounding territory comes under Roman control, with ~30 historically dated named roads (from DARE dataset) appearing at their attested construction dates. In the late empire, peripheral roads fade out to show decline.

---

## Visual Design

### Two road tiers

**Data reality:** All 14,769 Itiner-e features have `type: "secondary"`. The main/secondary distinction does not exist in the source data. Instead, we distinguish only between **named roads** (from DARE, with attested dates) and **territory-correlated roads** (everything else).

| Tier                      | Source                                                                        | Weight | Opacity | Label                                            | Dash                                          |
| ------------------------- | ----------------------------------------------------------------------------- | ------ | ------- | ------------------------------------------------ | --------------------------------------------- |
| **Named (attested date)** | DARE features with matching name (~68 segments across ~40 unique named roads) | `3.5`  | `0.9`   | Road name on hover; permanent label at zoom >= 7 | Solid                                         |
| **Territory-correlated**  | All Itiner-e roads + unnamed DARE roads                                       | `1.5`  | `0.5`   | Segment name on hover only                       | Solid (dashed if `certainty: "hypothetical"`) |

All tiers use the same color palette: `#b87333` (copper) for Itiner-e, `#d4a74a` (gold) for DARE. Only thickness differentiates named from unnamed.

### Decline styling

Roads in the decline phase get reduced opacity and a subtle dash pattern to suggest deterioration:

- Opacity fades from full → `0.2` over the decline window
- `dashArray` transitions from solid → `'6 4'` (worn road look)

---

## Temporal Logic

### 1. Named roads (~40 unique names in DARE, attested dates)

DARE contains 117 named road segments across ~40 unique road names (Via Appia, Via Flaminia, Via Egnatia, Strata Diocletiana, etc.). These are matched **by their existing `name` property** in the DARE dataset — no geographic matching needed.

A lookup table maps DARE road names to their attested construction year, normalizing naming variants (e.g., `via Sebaste` / `Via Sebaste` / `via_Tauri`):

```
"Via Appia"             → -312
"Via_Appia"             → -312
"Via Salaria"           → -340   (pre-Roman origins, formalized)
"Via Latina"            → -328
"Via Valeria"           → -289
"Via Amerina"           → -241
"Via Aurelia"           → -241
"Via_Aurelia"           → -241
"Via Flaminia"          → -220
"Via_Flaminia"          → -220
"Via Cassia"            → -154
"Via Postumia"          → -148
"Via_Postumia"          → -148
"Via_Popillia"          → -132
"Via Aemilia Scauri"    → -109
"Via_Aemilia"           → -187
"Via Clodia"            → -225
"Via Domitia"           → -118
"Via Egnatia"           → -146
"via Sebaste"           → -6
"Via Sebaste"           → -6
"Via Augusta"           → -8
"Via_Claudia_Augusta"   → -15
"Via Claudia Nova"      → 47
"Via Flavia"            → 78
"Via_Traiana"           → 109
"Via_Minucia_/_Traiana"  → 109
"Via Traiana Nova"      → 111
"Via Nova Traiana"      → 111
"Via Hadriana"          → 130
"Via_Herculia"          → 290
"Strata Diocletiana"    → 290
"Via Severiana"         → 198
"Hodos Berenikes"       → -200
```

Full historical justification: see `docs/research-roman-road-chronology.md`, Section 2.

**Appearance rule:** Named road visible when `currentYear >= attestedYear`. Named roads appear instantly (no 30-year fade-in — these were built in a few years, not decades).

### 2. Territory-correlated roads (Itiner-e + unnamed DARE)

For roads without an attested date, visibility is derived from territory data:

1. **Pre-compute:** For each road segment, sample **3 evenly-spaced points** along the geometry (not just centroid — this handles long segments spanning territories). For each point, check against territory snapshots chronologically. The road's `territoryYear` is the **earliest snapshot year** where any sample point falls inside a territory polygon.
2. **Gradual fade-in:** Roads don't snap to full opacity. Opacity ramps from `0` to full over a **30-year window** starting at `territoryYear + 20` (20-year construction lag after conquest). This simulates gradual construction radiating outward from conquest points.

**Fade-in formula:**

```
visibilityYear = territoryYear + 20
if currentYear < visibilityYear → hidden
if currentYear >= visibilityYear + 30 → full opacity
else → baseOpacity * ((currentYear - visibilityYear) / 30)
```

**Already-dated Itiner-e segments:** The 477 segments with existing non-zero `startYear` keep their original dates — the enrichment script skips them.

### 3. Road decline (territorial contraction → 476 AD)

Territory data has two IDs: `"rome"` and `"eastern-empire"` (appears at 400 AD). Since the territory is a single polygon that **shrinks** over time (not separate regional polygons), decline detection must be **spatial**: check whether a road's sample points still fall inside the territory polygon at later snapshots.

**Pre-computation (build-time):**

1. For each road segment, after finding its `territoryYear`, continue checking subsequent territory snapshots.
2. `declineYear` = the year of the **first later snapshot** where none of the road's sample points fall inside any territory polygon (rome or eastern-empire).
3. If the road remains inside territory through the 476 AD snapshot, `declineYear = null` (no decline).

**Decline formula (runtime):**

```
if declineYear is null → normal display (no decline)
if currentYear < declineYear → normal display
if currentYear >= declineYear + 50 → hidden (fully deteriorated)
else:
  declineProgress = (currentYear - declineYear) / 50
  opacity *= (1 - declineProgress)
  dashArray transitions: solid → '6 4' → '4 6'
```

---

## Data Pipeline

### Pre-computation step (build-time script)

Spatial joins (3 sample points × 17,935 features × 24 territory snapshots) are expensive. Pre-compute once and commit the results.

**Dependency:** `@turf/boolean-point-in-polygon`, `@turf/along`, `@turf/length` (devDependencies only — not bundled at runtime).

#### Enrichment script: `scripts/enrich-roads-temporal.ts`

**For DARE roads (`src/data/dare/roads.json` → `src/data/dare/roads-temporal.json`):**

1. Load DARE features and named-roads lookup table
2. For each feature:
   - If `name` matches lookup → set `attestedYear`, `isNamed = true`
   - Else → compute `territoryYear` and `declineYear` via spatial sampling
3. Write enriched GeoJSON

**For Itiner-e roads (`src/data/itinere/roads.json` → `src/data/itinere/roads-temporal.json`):**

1. Load Itiner-e features and territory snapshots
2. For each feature:
   - If `startYear !== 0` → preserve existing date, skip spatial computation
   - Else → compute `territoryYear` and `declineYear` via spatial sampling
3. Write enriched GeoJSON

**Enriched properties added to each feature:**

- `attestedYear: number | null` — from named-roads lookup (DARE only; null for Itiner-e and unnamed DARE)
- `territoryYear: number | null` — earliest territory snapshot containing this road (null if never inside any territory)
- `declineYear: number | null` — first snapshot where road falls outside all territories (null if road persists through 476)
- `isNamed: boolean` — true only for DARE roads with attested dates

**Spatial sampling approach:**

```
For a road segment geometry (MultiLineString):
  totalLength = turf.length(geometry)
  samplePoints = [
    turf.along(geometry, totalLength * 0.25),
    turf.along(geometry, totalLength * 0.5),
    turf.along(geometry, totalLength * 0.75)
  ]
  For each territory snapshot (sorted by year ascending):
    if any samplePoint is inside the territory polygon:
      territoryYear = snapshot.year
      break
```

### Runtime filtering

**Style function must be defined inside the component** (not module-level) so it captures `currentYear` from the store hook in its closure.

**ItinereRoadLayer — filter + style:**

```typescript
const currentYear = useTimelineStore((s) => s.currentYear)

const filteredFeatures = useMemo(() => {
  return data.features.filter((feature) => {
    const p = feature.properties

    // Already-dated segments: use original startYear/endYear
    if (p.startYear !== 0) {
      if (p.startYear > currentYear) return false
      if (p.endYear !== 0 && p.endYear < currentYear) return false
      return true
    }

    // Territory-correlated: visibility year = territoryYear + 20
    if (p.territoryYear === null) return false // never inside any territory
    const visYear = p.territoryYear + 20
    if (currentYear < visYear) return false

    // Decline check
    if (p.declineYear !== null && currentYear > p.declineYear + 50) return false

    return true
  })
}, [data, currentYear])

const getStyle = useCallback(
  (feature: Feature) => {
    const p = feature.properties
    const baseOpacity = 0.5
    const weight = 1.5

    // Fade-in (30 year ramp)
    let visYear: number
    if (p.startYear !== 0) {
      visYear = p.startYear
    } else {
      visYear = (p.territoryYear ?? 0) + 20
    }
    const fadeIn = Math.min(1, Math.max(0, (currentYear - visYear) / 30))
    let opacity = baseOpacity * fadeIn

    // Decline
    if (p.declineYear !== null && currentYear > p.declineYear) {
      const decay = Math.min(1, (currentYear - p.declineYear) / 50)
      opacity *= 1 - decay
    }

    const dashArray =
      p.declineYear !== null && currentYear > p.declineYear
        ? currentYear > p.declineYear + 25
          ? '4 6'
          : '6 4'
        : p.certainty === 'hypothetical'
          ? '4 3'
          : undefined

    return { weight, opacity, color: '#b87333', dashArray }
  },
  [currentYear],
)
```

**RoadLayer — same pattern for DARE data:**

```typescript
const currentYear = useTimelineStore((s) => s.currentYear)

const filteredFeatures = useMemo(() => {
  return data.features.filter((feature) => {
    const p = feature.properties

    // Named DARE roads: use attested year
    if (p.attestedYear !== null) {
      return currentYear >= p.attestedYear
    }

    // Territory-correlated
    if (p.territoryYear === null) return false
    const visYear = p.territoryYear + 20
    if (currentYear < visYear) return false
    if (p.declineYear !== null && currentYear > p.declineYear + 50) return false
    return true
  })
}, [data, currentYear])

const getStyle = useCallback(
  (feature: Feature) => {
    const p = feature.properties

    if (p.isNamed) {
      // Named roads: thick, full opacity, instant appearance (no fade-in)
      let opacity = 0.9
      if (p.declineYear !== null && currentYear > p.declineYear) {
        const decay = Math.min(1, (currentYear - p.declineYear) / 50)
        opacity *= 1 - decay
      }
      return { weight: 3.5, opacity, color: '#d4a74a' }
    }

    // Unnamed DARE roads: territory-correlated with fade-in
    const visYear = (p.territoryYear ?? 0) + 20
    const fadeIn = Math.min(1, Math.max(0, (currentYear - visYear) / 30))
    let opacity = (p.major ? 0.8 : 0.5) * fadeIn

    if (p.declineYear !== null && currentYear > p.declineYear) {
      const decay = Math.min(1, (currentYear - p.declineYear) / 50)
      opacity *= 1 - decay
    }

    return {
      weight: p.major ? 2.5 : 1.5,
      opacity,
      color: '#d4a74a',
      dashArray: p.unknown ? '4 3' : undefined,
    }
  },
  [currentYear],
)
```

---

## Performance Considerations

### Pre-computation eliminates runtime spatial queries

All point-in-polygon checks happen at build time. Runtime is just numeric comparisons — O(1) per feature.

### GeoJSON re-mount on year change

The existing `key={`itinere-roads-${currentYear}`}` pattern forces React-Leaflet to destroy and recreate the entire GeoJSON layer on every year change. With continuous opacity now varying per-feature, this causes DOM thrashing during timeline scrub/playback.

**Mitigation:** Enable Leaflet's canvas renderer by setting `preferCanvas: true` on the `<MapContainer>`. Canvas-rendered paths are significantly cheaper to create/destroy than SVG DOM elements. If performance is still insufficient after this change, a follow-up optimization would replace the `key`-based re-mount with direct `L.geoJSON.setStyle()` calls via a ref.

### File size

Adding 4 properties to 14,769 Itiner-e features + 3,166 DARE features adds ~300KB to the JSON. Since data is lazy-loaded and gzip-compressed in transit, the actual transfer increase is ~30-50KB — negligible.

---

## Component Changes

### Modified: `ItinereRoadLayer.tsx`

- Import `useTimelineStore` for `currentYear` (already imported)
- Load `roads-temporal.json` instead of `roads.json`
- Extended filter in `useMemo` (territory-correlated + decline)
- Style function moved inside component (needs `currentYear` closure)
- Per-feature opacity with fade-in and decline

### Modified: `RoadLayer.tsx`

- Import `useTimelineStore` for `currentYear` (new import)
- Load `roads-temporal.json` instead of `roads.json`
- Add `useMemo` filter (attested date for named, territory-correlated for unnamed, decline)
- Style function inside component with named vs unnamed logic
- Named road labels via tooltip at zoom >= 7

### Modified: `useMapLayerStore.ts`

- Loader functions import from `roads-temporal.json` files
- No structural changes to toggle logic

### Modified: `MapView.tsx` (or wherever `<MapContainer>` is)

- Add `preferCanvas={true}` prop for performance

### New: `scripts/enrich-roads-temporal.ts`

- Build-time Node script
- Uses `@turf/boolean-point-in-polygon`, `@turf/along`, `@turf/length` (devDependencies)
- Outputs `roads-temporal.json` for both Itiner-e and DARE
- Run once, commit output (data is static)

### New: `src/data/named-roads.ts`

- Lookup table: DARE road name → attested construction year
- ~40 entries with normalized variants (handles `via`/`Via`/`Via_` inconsistencies)
- Exported as `Record<string, number>`

---

## Edge Cases

1. **Roads outside any territory polygon:** Some roads (e.g., Black Sea coast Greek colonial roads in Itiner-e dated -514) predate Roman territory. These use their existing non-zero `startYear`. Roads with `startYear === 0` that never fall inside any territory snapshot get `territoryYear = null` and are hidden by default.

2. **Long road segments spanning territories:** Using 3 sample points (25%, 50%, 75% along the line) instead of a single centroid. The minimum `territoryYear` across all points is used — matching the intent that a road is accessible once any part of it enters Roman territory.

3. **Roads with existing `startYear` in Itiner-e (477 segments):** Preserved exactly as-is. The enrichment script does not override non-zero values. Some of these predate the earliest territory snapshot (-514 vs -500) — they appear as isolated roads in empty space, which is historically correct for Greek colonial routes.

4. **Timeline at -753 (default start):** No roads visible. First roads appear at -514 (Greek colonial Black Sea roads from Itiner-e) or -340 (Via Salaria in DARE, if using pre-Roman formalization date).

5. **DARE naming inconsistencies:** Names use mixed formats (`Via Appia`, `Via_Appia`, `via Sebaste`, `Via Sebaste`). The lookup table includes all variants. Matching is case-insensitive with underscore normalization.

6. **Territory snapshot resolution:** Snapshots are spaced 2–167 years apart. A road entering Roman territory between snapshots gets assigned the snapshot year, not the actual conquest year. This is a known approximation — temporal resolution is limited to the 22 available snapshots.

---

## Out of Scope

- Animating individual road segments being "drawn" along their path (too complex, marginal visual benefit)
- Street-level urban road networks (data doesn't exist at this scale)
- Road condition/repair cycles within the active period
- Interactive road detail panels (could be a future feature)
- Reclassifying Itiner-e roads as "main" vs "secondary" (all are `type: "secondary"` in source data; would require heuristic classification with no authoritative basis)
