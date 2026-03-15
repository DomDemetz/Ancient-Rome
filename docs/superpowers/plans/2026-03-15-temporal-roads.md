# Temporal Road Development Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Roman roads appear and disappear over time as the user scrubs the timeline, with named roads at historically attested dates, unnamed roads correlated to territory expansion, and peripheral roads fading during late-empire decline.

**Architecture:** A build-time enrichment script pre-computes `territoryYear` and `declineYear` for every road segment via spatial sampling (Turf.js point-in-polygon). The enriched JSON files replace the originals at runtime. The existing `RoadLayer` and `ItinereRoadLayer` components gain temporal filtering and per-feature opacity styling keyed to `currentYear`.

**Tech Stack:** TypeScript, Turf.js (devDependency), React-Leaflet, Zustand, Vitest

**Spec:** `docs/superpowers/specs/2026-03-15-temporal-roads-design.md`

---

## File Structure

| Action | Path                                    | Responsibility                                               |
| ------ | --------------------------------------- | ------------------------------------------------------------ |
| Create | `src/data/named-roads.ts`               | Lookup table: DARE road name → attested construction year    |
| Create | `scripts/enrich-roads-temporal.ts`      | Build-time script: spatial joins + enrichment                |
| Create | `src/data/dare/roads-temporal.json`     | Enriched DARE roads (generated, committed)                   |
| Create | `src/data/itinere/roads-temporal.json`  | Enriched Itiner-e roads (generated, committed)               |
| Create | `src/lib/road-style.ts`                 | Shared temporal style/filter logic used by both layers       |
| Modify | `src/data/dare/index.ts:17-20`          | `loadRoads()` → import `roads-temporal.json`                 |
| Modify | `src/data/itinere/index.ts:3-6`         | `loadItinereRoads()` → import `roads-temporal.json`          |
| Modify | `src/features/map/RoadLayer.tsx`        | Add temporal filtering, per-feature style, named road labels |
| Modify | `src/features/map/ItinereRoadLayer.tsx` | Extend filter for territory-correlated + decline             |
| Modify | `src/features/map/MapView.tsx:159`      | Add `preferCanvas={true}` to `<MapContainer>`                |
| Create | `src/lib/road-style.test.ts`            | Unit tests for filter + style logic                          |

---

## Chunk 1: Named Roads Lookup + Shared Style Logic

### Task 1: Create the named roads lookup table

**Files:**

- Create: `src/data/named-roads.ts`

- [ ] **Step 1: Create the lookup file**

```typescript
// src/data/named-roads.ts

/**
 * Maps DARE road `name` property → attested construction year.
 * Includes variant spellings (Via_Appia, via Sebaste, etc.).
 * Sources: docs/research-roman-road-chronology.md
 */

function normalize(name: string): string {
  return name.replace(/_/g, ' ').replace(/\?$/g, '').toLowerCase().trim()
}

const ATTESTED_DATES: Record<string, number> = {
  'via salaria': -340,
  'via salaria vetus': -340,
  'via latina': -328,
  'via appia': -312,
  'via valeria': -289,
  'via claudia valeria': -289,
  'via amerina': -241,
  'via aurelia': -241,
  'via clodia': -225,
  'via flaminia': -220,
  'via aemilia': -187,
  'via aemilia scauri': -109,
  'via aemilia scauri/ via aurelia': -109,
  'via aemilia scauri/via iulia augusta': -109,
  'via cassia': -154,
  'via postumia': -148,
  'via postumia/via iulia augusta': -148,
  'via popillia': -132,
  'via egnatia': -146,
  'via domitia': -118,
  'hodos berenikes': -200,
  'hodos myos hormou/mysormitike': -200,
  'via iulia augusta': -13,
  'via claudia augusta': -15,
  'via augusta': -8,
  'via sebaste': -6,
  'via cornelia': -30,
  'via labicana': -30,
  'via praenestina': -30,
  'via tiburtina': -30,
  'via nomentana': -30,
  'via collatina': -30,
  'via ostiensis': -30,
  'via portuensis': -30,
  'via laurentina': -30,
  'via ardeatina': -30,
  'via triumphalis': -30,
  'via campana': -30,
  'via curia': -30,
  'via caecilia': -200,
  'via claudia nova': 47,
  'via flavia': 78,
  'via traiana': 109,
  'via minucia / traiana': 109,
  'via traiana nova': 111,
  'via nova traiana': 111,
  'via hadriana': 130,
  'via severiana': 198,
  'via herculia': 290,
  'via herdonitana': 109,
  'via annia': -131,
  'via popillia': -132,
  'via pompeia': 61,
  'via caminia': -241,
  'via ciminia': -241,
  'via per alpes numidicas': 123,
  'via quinctia': -123,
  'strata diocletiana': 290,
  'iter praeter caput saxi': -200,
  'via militaris': 33,
}

export function getAttestedYear(name: string): number | null {
  return ATTESTED_DATES[normalize(name)] ?? null
}

export function isNamedRoad(name: string | undefined): boolean {
  if (!name) return false
  return normalize(name) in ATTESTED_DATES
}
```

- [ ] **Step 2: Commit**

```bash
git add src/data/named-roads.ts
git commit -m "feat: add named Roman roads lookup table with attested construction dates"
```

---

### Task 2: Create shared road style/filter utilities

**Files:**

- Create: `src/lib/road-style.ts`
- Create: `src/lib/road-style.test.ts`

- [ ] **Step 1: Write tests for the temporal filter and style logic**

```typescript
// src/lib/road-style.test.ts
import { describe, it, expect } from 'vitest'
import { shouldShowRoad, getRoadOpacity, getDeclineDash } from './road-style'

describe('shouldShowRoad', () => {
  it('hides named DARE road before attested year', () => {
    expect(shouldShowRoad({ attestedYear: -312, isNamed: true }, -400)).toBe(false)
  })

  it('shows named DARE road at attested year', () => {
    expect(shouldShowRoad({ attestedYear: -312, isNamed: true }, -312)).toBe(true)
  })

  it('hides territory-correlated road before visibility year (territoryYear + 20)', () => {
    expect(shouldShowRoad({ territoryYear: -264 }, -260)).toBe(false)
  })

  it('shows territory-correlated road at visibility year', () => {
    expect(shouldShowRoad({ territoryYear: -264 }, -244)).toBe(true)
  })

  it('hides road 50+ years after decline', () => {
    expect(shouldShowRoad({ territoryYear: -264, declineYear: 400 }, 451)).toBe(false)
  })

  it('shows road within 50-year decline window', () => {
    expect(shouldShowRoad({ territoryYear: -264, declineYear: 400 }, 430)).toBe(true)
  })

  it('preserves existing non-zero startYear', () => {
    expect(shouldShowRoad({ startYear: -514, endYear: 0 }, -520)).toBe(false)
    expect(shouldShowRoad({ startYear: -514, endYear: 0 }, -514)).toBe(true)
  })

  it('respects existing endYear', () => {
    expect(shouldShowRoad({ startYear: -200, endYear: -49 }, -50)).toBe(true)
    expect(shouldShowRoad({ startYear: -200, endYear: -49 }, -48)).toBe(false)
  })

  it('hides road with null territoryYear (outside all territories)', () => {
    expect(shouldShowRoad({ territoryYear: null }, 100)).toBe(false)
  })
})

describe('getRoadOpacity', () => {
  it('returns full opacity for named roads (no fade-in)', () => {
    expect(getRoadOpacity({ attestedYear: -312, isNamed: true }, -312, 0.9)).toBe(0.9)
  })

  it('returns 0 opacity at start of fade-in window', () => {
    expect(getRoadOpacity({ territoryYear: -264 }, -244, 0.5)).toBeCloseTo(0, 2)
  })

  it('returns half opacity midway through fade-in', () => {
    expect(getRoadOpacity({ territoryYear: -264 }, -229, 0.5)).toBeCloseTo(0.25, 2)
  })

  it('returns full opacity after fade-in complete', () => {
    expect(getRoadOpacity({ territoryYear: -264 }, -200, 0.5)).toBe(0.5)
  })

  it('reduces opacity during decline', () => {
    const opacity = getRoadOpacity({ territoryYear: -264, declineYear: 400 }, 425, 0.5)
    expect(opacity).toBeLessThan(0.5)
    expect(opacity).toBeGreaterThan(0)
  })

  it('returns 0 opacity at end of decline window', () => {
    expect(getRoadOpacity({ territoryYear: -264, declineYear: 400 }, 450, 0.5)).toBeCloseTo(0, 2)
  })
})

describe('getDeclineDash', () => {
  it('returns undefined for normal road', () => {
    expect(getDeclineDash(null, 100, false)).toBeUndefined()
  })

  it('returns hypothetical dash for hypothetical road', () => {
    expect(getDeclineDash(null, 100, true)).toBe('4 3')
  })

  it('returns early decline dash', () => {
    expect(getDeclineDash(400, 410, false)).toBe('6 4')
  })

  it('returns late decline dash', () => {
    expect(getDeclineDash(400, 430, false)).toBe('4 6')
  })

  it('decline dash overrides hypothetical', () => {
    expect(getDeclineDash(400, 410, true)).toBe('6 4')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/road-style.test.ts`
Expected: FAIL — module `../road-style` not found

- [ ] **Step 3: Implement the shared utilities**

```typescript
// src/lib/road-style.ts

interface TemporalRoadProps {
  startYear?: number
  endYear?: number
  attestedYear?: number | null
  isNamed?: boolean
  territoryYear?: number | null
  declineYear?: number | null
}

/**
 * Determines whether a road segment should be visible at the given year.
 */
export function shouldShowRoad(props: TemporalRoadProps, currentYear: number): boolean {
  // Named DARE roads: use attested year, no territory logic
  if (props.attestedYear != null) {
    return currentYear >= props.attestedYear
  }

  // Already-dated Itiner-e segments: use original startYear/endYear
  if (props.startYear != null && props.startYear !== 0) {
    if (props.startYear > currentYear) return false
    if (props.endYear != null && props.endYear !== 0 && props.endYear < currentYear) return false
    return true
  }

  // Territory-correlated: visibility year = territoryYear + 20
  if (props.territoryYear == null) return false
  const visYear = props.territoryYear + 20
  if (currentYear < visYear) return false

  // Decline: hidden after 50 years past decline start
  if (props.declineYear != null && currentYear > props.declineYear + 50) return false

  return true
}

/**
 * Computes the opacity for a road segment at the given year.
 * Handles fade-in (30-year ramp) and decline (50-year decay).
 * Named roads have no fade-in (instant appearance).
 */
export function getRoadOpacity(
  props: TemporalRoadProps,
  currentYear: number,
  baseOpacity: number,
): number {
  // Named roads: instant appearance, no fade-in
  if (props.isNamed && props.attestedYear != null) {
    let opacity = baseOpacity
    if (props.declineYear != null && currentYear > props.declineYear) {
      const decay = Math.min(1, (currentYear - props.declineYear) / 50)
      opacity *= 1 - decay
    }
    return opacity
  }

  // Compute visibility year
  let visYear: number
  if (props.startYear != null && props.startYear !== 0) {
    visYear = props.startYear
  } else {
    visYear = (props.territoryYear ?? 0) + 20
  }

  // Fade-in over 30 years
  const fadeIn = Math.min(1, Math.max(0, (currentYear - visYear) / 30))
  let opacity = baseOpacity * fadeIn

  // Decline over 50 years
  if (props.declineYear != null && currentYear > props.declineYear) {
    const decay = Math.min(1, (currentYear - props.declineYear) / 50)
    opacity *= 1 - decay
  }

  return opacity
}

/**
 * Returns a dashArray string for decline styling, or undefined for normal.
 */
export function getDeclineDash(
  declineYear: number | null | undefined,
  currentYear: number,
  hypothetical: boolean,
): string | undefined {
  if (declineYear != null && currentYear > declineYear) {
    return currentYear > declineYear + 25 ? '4 6' : '6 4'
  }
  return hypothetical ? '4 3' : undefined
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/road-style.test.ts`
Expected: all 17 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/road-style.ts src/lib/road-style.test.ts
git commit -m "feat: add temporal road filter/style utilities with tests"
```

---

## Chunk 2: Build-Time Enrichment Script

### Task 3: Install Turf.js devDependencies

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Install turf modules**

Run: `npm install --save-dev @turf/boolean-point-in-polygon @turf/along @turf/length @turf/helpers`

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add turf.js spatial libs as devDependencies"
```

---

### Task 4: Create the enrichment script

**Files:**

- Create: `scripts/enrich-roads-temporal.ts`

This script follows the pattern of existing scripts (e.g., `scripts/generate-itinere-roads.ts`) — standalone TypeScript run via `npx tsx`.

- [ ] **Step 1: Write the enrichment script**

```typescript
// scripts/enrich-roads-temporal.ts
/**
 * Enriches DARE and Itiner-e road data with temporal properties:
 * - attestedYear / isNamed: from named-roads lookup (DARE only)
 * - territoryYear: earliest territory snapshot containing the road
 * - declineYear: first snapshot where territory no longer contains the road
 *
 * Usage: npx tsx scripts/enrich-roads-temporal.ts
 */

import { readFile, writeFile } from 'fs/promises'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import along from '@turf/along'
import length from '@turf/length'
import { lineString } from '@turf/helpers'
import type { Feature, MultiLineString, MultiPolygon, Position } from 'geojson'
import { getAttestedYear } from '../src/data/named-roads'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(__dirname, '../src/data')

// --- Territory data ---

interface TerritorySnapshot {
  id: string
  year: number
  boundaries: Feature<MultiPolygon>
}

async function loadTerritories(): Promise<TerritorySnapshot[]> {
  const raw = JSON.parse(await readFile(resolve(dataDir, 'territories/territories.json'), 'utf-8'))
  return (raw as TerritorySnapshot[]).sort((a, b) => a.year - b.year)
}

// --- Spatial helpers ---

/**
 * Sample 3 points along a MultiLineString at 25%, 50%, 75% of total length.
 * Falls back to first coordinate if the geometry is too short.
 */
function samplePoints(geometry: MultiLineString): Position[] {
  // Flatten MultiLineString into a single line for sampling
  const allCoords: Position[] = []
  for (const line of geometry.coordinates) {
    allCoords.push(...line)
  }

  if (allCoords.length < 2) {
    return allCoords.length === 1 ? [allCoords[0]] : []
  }

  try {
    const line = lineString(allCoords)
    const totalLen = length(line, { units: 'kilometers' })
    if (totalLen < 0.001) {
      return [allCoords[0]]
    }
    return [0.25, 0.5, 0.75].map((frac) => {
      const pt = along(line, totalLen * frac, { units: 'kilometers' })
      return pt.geometry.coordinates
    })
  } catch {
    // If geometry is degenerate, fall back to first coord
    return [allCoords[0]]
  }
}

function isInsideAnyTerritory(
  point: Position,
  snapshots: TerritorySnapshot[],
  year: number,
): boolean {
  for (const snap of snapshots) {
    if (snap.year !== year) continue
    try {
      if (booleanPointInPolygon(point, snap.boundaries.geometry)) {
        return true
      }
    } catch {
      // Skip malformed polygons
    }
  }
  return false
}

/**
 * Find the earliest territory snapshot year where any sample point is inside a territory.
 */
function findTerritoryYear(points: Position[], snapshots: TerritorySnapshot[]): number | null {
  const years = [...new Set(snapshots.map((s) => s.year))].sort((a, b) => a - b)
  for (const year of years) {
    for (const pt of points) {
      if (isInsideAnyTerritory(pt, snapshots, year)) {
        return year
      }
    }
  }
  return null
}

/**
 * Find the first snapshot year after territoryYear where no sample point is inside any territory.
 */
function findDeclineYear(
  points: Position[],
  snapshots: TerritorySnapshot[],
  territoryYear: number,
): number | null {
  const years = [...new Set(snapshots.map((s) => s.year))].sort((a, b) => a - b)
  let wasInside = false

  for (const year of years) {
    if (year < territoryYear) continue

    const inside = points.some((pt) => isInsideAnyTerritory(pt, snapshots, year))
    if (inside) {
      wasInside = true
    } else if (wasInside) {
      return year
    }
  }
  return null
}

// --- Main ---

async function enrichDare(territories: TerritorySnapshot[]): Promise<void> {
  console.log('Loading DARE roads...')
  const raw = JSON.parse(await readFile(resolve(dataDir, 'dare/roads.json'), 'utf-8'))
  const features = raw.features as Feature<MultiLineString>[]
  let named = 0
  let correlated = 0
  let outside = 0

  for (const feature of features) {
    const name = feature.properties?.name as string | undefined
    const attested = name ? getAttestedYear(name) : null

    if (attested !== null) {
      // Named roads still need decline detection
      const points = samplePoints(feature.geometry)
      const territoryYear = points.length > 0 ? findTerritoryYear(points, territories) : null
      const declineYear =
        territoryYear !== null ? findDeclineYear(points, territories, territoryYear) : null
      feature.properties = {
        ...feature.properties,
        attestedYear: attested,
        isNamed: true,
        territoryYear,
        declineYear,
      }
      named++
    } else {
      const points = samplePoints(feature.geometry)
      const territoryYear = points.length > 0 ? findTerritoryYear(points, territories) : null
      const declineYear =
        territoryYear !== null ? findDeclineYear(points, territories, territoryYear) : null

      feature.properties = {
        ...feature.properties,
        attestedYear: null,
        isNamed: false,
        territoryYear,
        declineYear,
      }
      if (territoryYear !== null) correlated++
      else outside++
    }
  }

  const outPath = resolve(dataDir, 'dare/roads-temporal.json')
  await writeFile(outPath, JSON.stringify(raw, null, 2))
  console.log(
    `DARE: ${features.length} features → ${named} named, ${correlated} correlated, ${outside} outside`,
  )
}

async function enrichItinere(territories: TerritorySnapshot[]): Promise<void> {
  console.log('Loading Itiner-e roads...')
  const raw = JSON.parse(await readFile(resolve(dataDir, 'itinere/roads.json'), 'utf-8'))
  const features = raw.features as Feature<MultiLineString>[]
  let preserved = 0
  let correlated = 0
  let outside = 0

  for (const feature of features) {
    const startYear = (feature.properties?.startYear as number) ?? 0

    // Preserve existing non-zero dates
    if (startYear !== 0) {
      feature.properties = {
        ...feature.properties,
        attestedYear: null,
        isNamed: false,
        territoryYear: null,
        declineYear: null,
      }
      preserved++
      continue
    }

    const points = samplePoints(feature.geometry)
    const territoryYear = points.length > 0 ? findTerritoryYear(points, territories) : null
    const declineYear =
      territoryYear !== null ? findDeclineYear(points, territories, territoryYear) : null

    feature.properties = {
      ...feature.properties,
      attestedYear: null,
      isNamed: false,
      territoryYear,
      declineYear,
    }
    if (territoryYear !== null) correlated++
    else outside++
  }

  const outPath = resolve(dataDir, 'itinere/roads-temporal.json')
  await writeFile(outPath, JSON.stringify(raw, null, 2))
  console.log(
    `Itiner-e: ${features.length} features → ${preserved} preserved, ${correlated} correlated, ${outside} outside`,
  )
}

async function main() {
  console.log('=== Enriching road data with temporal properties ===\n')
  const territories = await loadTerritories()
  console.log(`Loaded ${territories.length} territory snapshots\n`)

  await enrichDare(territories)
  console.log()
  await enrichItinere(territories)
  console.log('\nDone!')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2: Run the enrichment script**

Run: `npx tsx scripts/enrich-roads-temporal.ts`
Expected: Script completes, prints counts, creates `src/data/dare/roads-temporal.json` and `src/data/itinere/roads-temporal.json`

- [ ] **Step 3: Verify output files exist and have enriched properties**

Run: `node -e "const d=require('./src/data/dare/roads-temporal.json'); const f=d.features[0].properties; console.log('DARE sample:', {attestedYear: f.attestedYear, isNamed: f.isNamed, territoryYear: f.territoryYear, declineYear: f.declineYear}); const named=d.features.filter(f=>f.properties.isNamed).length; console.log('Named count:', named)"`

Expected: Properties present, ~68 named features

Run: `node -e "const d=require('./src/data/itinere/roads-temporal.json'); const f=d.features.find(f=>f.properties.startYear===0); console.log('Itinere undated sample:', {territoryYear: f.properties.territoryYear, declineYear: f.properties.declineYear}); const outside=d.features.filter(f=>f.properties.startYear===0 && f.properties.territoryYear===null).length; console.log('Outside territory:', outside, '/', d.features.length)"`

Expected: territoryYear is a number (not null) for most features

- [ ] **Step 4: Commit**

```bash
git add scripts/enrich-roads-temporal.ts src/data/dare/roads-temporal.json src/data/itinere/roads-temporal.json
git commit -m "feat: add build-time enrichment script and generate temporal road data"
```

---

## Chunk 3: Update Data Loaders + Components

### Task 5: Update data loader functions

**Files:**

- Modify: `src/data/dare/index.ts:17-20`
- Modify: `src/data/itinere/index.ts:3-6`

- [ ] **Step 1: Update DARE loader**

In `src/data/dare/index.ts`, change `loadRoads()` to import from `roads-temporal.json`:

```typescript
// Line 17-20: change './roads.json' → './roads-temporal.json'
export async function loadRoads(): Promise<FeatureCollection> {
  const data = await import('./roads-temporal.json')
  return data.default as unknown as FeatureCollection
}
```

- [ ] **Step 2: Update Itiner-e loader**

In `src/data/itinere/index.ts`, change to import from `roads-temporal.json`:

```typescript
// Line 3-6: change './roads.json' → './roads-temporal.json'
export async function loadItinereRoads(): Promise<FeatureCollection> {
  const data = await import('./roads-temporal.json')
  return data.default as unknown as FeatureCollection
}
```

- [ ] **Step 3: Verify the app still builds**

Run: `npm run build`
Expected: Build succeeds (the enriched JSON has a superset of the original properties)

- [ ] **Step 4: Commit**

```bash
git add src/data/dare/index.ts src/data/itinere/index.ts
git commit -m "feat: switch road loaders to enriched temporal data files"
```

---

### Task 6: Add `preferCanvas` to MapContainer

**Files:**

- Modify: `src/features/map/MapView.tsx:159-165`

- [ ] **Step 1: Add preferCanvas prop**

In `src/features/map/MapView.tsx`, add `preferCanvas={true}` to the `<MapContainer>`:

```typescript
// Lines 159-165: add preferCanvas
        <MapContainer
          center={ROME_CENTER}
          zoom={DEFAULT_ZOOM}
          style={{ width: '100%', height: '100%', background: '#0f0a1a' }}
          zoomControl={true}
          preferCanvas={true}
          ref={mapRef}
        >
```

- [ ] **Step 2: Commit**

```bash
git add src/features/map/MapView.tsx
git commit -m "perf: enable canvas renderer for map layers"
```

---

### Task 7: Update RoadLayer with temporal filtering

**Files:**

- Modify: `src/features/map/RoadLayer.tsx`

- [ ] **Step 1: Rewrite RoadLayer with temporal support**

Replace the entire contents of `src/features/map/RoadLayer.tsx`:

```typescript
import { GeoJSON } from 'react-leaflet'
import type { FeatureCollection, Feature } from 'geojson'
import type { PathOptions } from 'leaflet'
import L from 'leaflet'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useMemo, useCallback } from 'react'
import { shouldShowRoad, getRoadOpacity, getDeclineDash } from '@/lib/road-style'

interface RoadLayerProps {
  data: FeatureCollection
}

export function RoadLayer({ data }: RoadLayerProps) {
  const currentYear = useTimelineStore((s) => s.currentYear)

  const filtered = useMemo(() => {
    const features = data.features.filter((f) => {
      return shouldShowRoad(f.properties || {}, currentYear)
    })
    return { ...data, features }
  }, [data, currentYear])

  const getStyle = useCallback(
    (feature: Feature | undefined): PathOptions => {
      const props = feature?.properties || {}

      if (props.isNamed) {
        const opacity = getRoadOpacity(props, currentYear, 0.9)
        const dashArray = getDeclineDash(props.declineYear, currentYear, false)
        return { weight: 3.5, opacity, color: '#d4a74a', dashArray }
      }

      const isMajor = props.major === true
      const isUnknown = props.unknown === true
      const baseOpacity = isMajor ? 0.8 : 0.5
      const opacity = getRoadOpacity(props, currentYear, baseOpacity)
      const dashArray = getDeclineDash(props.declineYear, currentYear, isUnknown)

      return {
        color: '#d4a74a',
        weight: isMajor ? 2.5 : 1.5,
        opacity,
        dashArray,
      }
    },
    [currentYear],
  )

  const onEachRoad = useCallback((feature: Feature, layer: L.Layer) => {
    const name = feature.properties?.name
    if (name) {
      ;(layer as L.Path).bindTooltip(name, { sticky: true })
    }
  }, [])

  return (
    <GeoJSON
      key={`dare-roads-${currentYear}`}
      data={filtered}
      style={getStyle}
      onEachFeature={onEachRoad}
    />
  )
}
```

- [ ] **Step 2: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/features/map/RoadLayer.tsx
git commit -m "feat: add temporal filtering and per-feature styling to RoadLayer"
```

---

### Task 8: Update ItinereRoadLayer with temporal filtering

**Files:**

- Modify: `src/features/map/ItinereRoadLayer.tsx`

- [ ] **Step 1: Rewrite ItinereRoadLayer with temporal support**

Replace the entire contents of `src/features/map/ItinereRoadLayer.tsx`:

```typescript
import { GeoJSON } from 'react-leaflet'
import type { FeatureCollection, Feature } from 'geojson'
import type { PathOptions } from 'leaflet'
import L from 'leaflet'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useMemo, useCallback } from 'react'
import { shouldShowRoad, getRoadOpacity, getDeclineDash } from '@/lib/road-style'

interface ItinereRoadLayerProps {
  data: FeatureCollection
}

export function ItinereRoadLayer({ data }: ItinereRoadLayerProps) {
  const currentYear = useTimelineStore((s) => s.currentYear)

  const filtered = useMemo(() => {
    const features = data.features.filter((f) => {
      return shouldShowRoad(f.properties || {}, currentYear)
    })
    return { ...data, features }
  }, [data, currentYear])

  const getStyle = useCallback(
    (feature: Feature | undefined): PathOptions => {
      const props = feature?.properties || {}
      const certainty = props.certainty as string
      const isHypothetical = certainty === 'hypothetical' || certainty === 'conjectured'
      const opacity = getRoadOpacity(props, currentYear, 0.5)
      const dashArray = getDeclineDash(props.declineYear, currentYear, isHypothetical)

      return {
        color: '#b87333',
        weight: 1.5,
        opacity,
        dashArray,
      }
    },
    [currentYear],
  )

  const onEachRoad = useCallback((feature: Feature, layer: L.Layer) => {
    const props = feature.properties || {}
    const parts: string[] = []
    if (props.name) parts.push(props.name)
    if (props.builder && props.builder !== 'Conjectured' && props.builder !== 'Hypothetical' && props.builder !== 'Certain') {
      parts.push(`Built by: ${props.builder}`)
    }
    if (parts.length > 0) {
      ;(layer as L.Path).bindTooltip(parts.join('<br>'), { sticky: true })
    }
  }, [])

  return (
    <GeoJSON
      key={`itinere-roads-${currentYear}`}
      data={filtered}
      style={getStyle}
      onEachFeature={onEachRoad}
    />
  )
}
```

- [ ] **Step 2: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/features/map/ItinereRoadLayer.tsx
git commit -m "feat: add temporal filtering and per-feature styling to ItinereRoadLayer"
```

---

## Chunk 4: Verification

### Task 9: Run all tests

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: All tests pass, including the new `road-style.test.ts`

- [ ] **Step 2: Run the dev server and manually verify**

Run: `npm run dev`

Manual checks:

1. Open the app, enable both road layers
2. Set timeline to -753: **no roads visible**
3. Scrub to -312: **Via Appia appears** (thick gold line, Rome→Capua direction)
4. Scrub to -220: **Via Flaminia appears** (Rome→Rimini)
5. Scrub to -146: **Via Egnatia appears** (Balkans)
6. Scrub to 117 (Trajan): **dense road network** across empire
7. Scrub to 400-476: **peripheral roads fading out** with dashed styling
8. Roads should fade in gradually (not snap), except named roads which appear instantly

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address manual verification feedback"
```

---

## Execution Notes

- **Script runtime:** The enrichment script processes ~18,000 features × 24 territory snapshots × 3 sample points. Expect 30-60 seconds runtime. If it's slow, the `booleanPointInPolygon` calls on complex MultiPolygons are the bottleneck — this is acceptable since it only runs once.
- **If the enrichment script crashes** on a specific feature's geometry, add a try/catch around the `samplePoints` call and default to `territoryYear: null` for degenerate geometries.
- **If too many roads show `territoryYear: null`** (outside all territory polygons), the territory polygons may not cover enough area. Check by logging the count — up to ~10-15% outside is expected for roads in unconquered peripheral areas.
- **The original `roads.json` files are not deleted** — they remain as the source-of-truth. The `roads-temporal.json` files are derived artifacts.
