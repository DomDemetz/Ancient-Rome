/**
 * Enriches multiple data layers with temporal properties via territory correlation.
 *
 * For each feature (point or line), finds:
 * - territoryYear: earliest territory snapshot containing the feature
 * - declineYear: first later snapshot where feature falls outside all territories
 *
 * Layers enriched:
 * - Phase 1: Fortifications, AWMC Aqueducts, Trade Network (ORBIS)
 * - Phase 2: Settlements (undated), Vici Sites (undated), DARMC Places, IDAI Sites, Pelagios Places
 *
 * Usage: npx tsx scripts/enrich-temporal.ts [stage ...]
 * Stages: fortifications, aqueducts, trade, points. No args = all stages.
 * The `points` stages rewrite their INPUT files in place — don't run them
 * while other pipeline work has those files in flight.
 */

import { readFile, writeFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import length from '@turf/length'
import along from '@turf/along'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { lineString, point } from '@turf/helpers'
import type { Feature, MultiPolygon, Position } from 'geojson'

// ── Types ──

interface TerritorySnapshot {
  id: string
  year: number
  status?: string
  boundaries: Feature<MultiPolygon>
}

interface GeoJSONFeature {
  type: 'Feature'
  properties: Record<string, unknown>
  geometry: {
    type: string
    coordinates: number[][][] | number[][]
  }
}

interface FeatureCollection {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
}

interface PointRecord {
  lat: number
  lng: number
  startYear?: number
  endYear?: number
  territoryYear?: number | null
  declineYear?: number | null
  [key: string]: unknown
}

interface TradeNetwork {
  sites: (PointRecord & { id: string; name: string; siteType: string })[]
  routes: {
    id: string
    from: string
    to: string
    transportType: string
    distanceKm: number
    coordinates: [number, number][]
    territoryYear?: number | null
    declineYear?: number | null
  }[]
}

// ── Helpers ──

function resolvePath(relative: string): string {
  return fileURLToPath(new URL(relative, import.meta.url))
}

async function loadJSON<T>(relative: string): Promise<T> {
  const path = resolvePath(relative)
  const raw = await readFile(path, 'utf-8')
  return JSON.parse(raw) as T
}

/**
 * Flatten MultiLineString coordinates into a single LineString coordinate array.
 */
function flattenToLineString(geometry: {
  type: string
  coordinates: number[][][] | number[][]
}): Position[] {
  const coords = geometry.coordinates
  if (geometry.type === 'MultiLineString') {
    const allPoints: Position[] = []
    for (const line of coords as number[][][]) {
      allPoints.push(...line)
    }
    return allPoints
  }
  return coords as number[][]
}

/**
 * Sample 3 points along a line at 25%, 50%, 75% of total length.
 */
function sampleLinePoints(flatCoords: Position[]): Position[] {
  if (flatCoords.length < 2) return []
  try {
    const line = lineString(flatCoords)
    const totalLength = length(line, { units: 'kilometers' })
    if (totalLength === 0) return []
    const points: Position[] = []
    for (const frac of [0.25, 0.5, 0.75]) {
      const pt = along(line, totalLength * frac, { units: 'kilometers' })
      points.push(pt.geometry.coordinates)
    }
    return points
  } catch {
    return []
  }
}

/**
 * Check if any sample point falls inside the territory polygon for a given snapshot.
 */
function isInsideTerritory(samplePts: Position[], snapshot: TerritorySnapshot): boolean {
  for (const coords of samplePts) {
    try {
      const pt = point(coords)
      if (booleanPointInPolygon(pt, snapshot.boundaries)) {
        return true
      }
    } catch {
      // skip degenerate geometry
    }
  }
  return false
}

/**
 * Find earliest territory year and decline year for a set of sample points.
 */
function computeTerritoryYears(
  samplePts: Position[],
  sortedSnapshots: TerritorySnapshot[],
  snapshotsByYear: Map<number, TerritorySnapshot[]>,
  sortedYears: number[],
): { territoryYear: number | null; declineYear: number | null } {
  if (samplePts.length === 0) {
    return { territoryYear: null, declineYear: null }
  }

  // Find earliest snapshot where feature is inside territory
  let territoryYear: number | null = null
  let firstInsideYearIdx = -1

  for (let i = 0; i < sortedYears.length; i++) {
    const yearSnapshots = snapshotsByYear.get(sortedYears[i])!
    if (yearSnapshots.some((snap) => isInsideTerritory(samplePts, snap))) {
      territoryYear = sortedYears[i]
      firstInsideYearIdx = i
      break
    }
  }

  if (territoryYear === null) {
    return { territoryYear: null, declineYear: null }
  }

  // Decline = first year outside ALL territory AFTER the last year inside.
  // Territory can be lost and recovered (Gallic Empire 261-283, Justinian's
  // reconquests), so the first outside year is not the decline.
  let declineYear: number | null = null
  for (let yi = firstInsideYearIdx + 1; yi < sortedYears.length; yi++) {
    const yearSnapshots = snapshotsByYear.get(sortedYears[yi])!
    const insideAny = yearSnapshots.some((snap) => isInsideTerritory(samplePts, snap))
    if (insideAny) {
      declineYear = null
    } else if (declineYear === null) {
      declineYear = sortedYears[yi]
    }
  }

  return { territoryYear, declineYear }
}

// ── Pre-compute territory index ──

function buildTerritoryIndex(sortedSnapshots: TerritorySnapshot[]) {
  const snapshotsByYear = new Map<number, TerritorySnapshot[]>()
  for (const snap of sortedSnapshots) {
    if (!snapshotsByYear.has(snap.year)) {
      snapshotsByYear.set(snap.year, [])
    }
    snapshotsByYear.get(snap.year)!.push(snap)
  }
  const sortedYears = [...snapshotsByYear.keys()].sort((a, b) => a - b)
  return { snapshotsByYear, sortedYears }
}

// ── Enrichment functions ──

async function enrichFortifications(
  sortedSnapshots: TerritorySnapshot[],
  index: ReturnType<typeof buildTerritoryIndex>,
) {
  console.log('\n── Fortifications ──')
  const data = await loadJSON<FeatureCollection>('../src/data/dare/fortifications.json')
  console.log(`  Features: ${data.features.length}`)

  let correlated = 0
  let outside = 0

  const enriched = data.features.map((feature) => {
    const flatCoords = flattenToLineString(feature.geometry)
    const samplePts = sampleLinePoints(flatCoords)
    const { territoryYear, declineYear } = computeTerritoryYears(
      samplePts,
      sortedSnapshots,
      index.snapshotsByYear,
      index.sortedYears,
    )

    if (territoryYear !== null) correlated++
    else outside++

    return {
      ...feature,
      properties: {
        ...feature.properties,
        territoryYear,
        declineYear,
      },
    }
  })

  console.log(`  Correlated: ${correlated}, Outside: ${outside}`)

  const output: FeatureCollection = { type: 'FeatureCollection', features: enriched }
  const outPath = resolvePath('../src/data/dare/fortifications-temporal.json')
  await writeFile(outPath, JSON.stringify(output) + '\n')
  console.log(`  ✓ Wrote ${outPath}`)
}

async function enrichAqueductLines(
  sortedSnapshots: TerritorySnapshot[],
  index: ReturnType<typeof buildTerritoryIndex>,
) {
  console.log('\n── AWMC Aqueduct Lines ──')
  const data = await loadJSON<FeatureCollection>('../src/data/awmc-aqueducts.json')
  const datedPoints = await loadJSON<
    { id: string; name: string; constructionYear: number; cityServed: string }[]
  >('../src/data/aqueducts/aqueducts.json')

  console.log(`  Line features: ${data.features.length}`)
  console.log(`  Dated point references: ${datedPoints.length}`)

  // Build name-to-constructionYear lookup from dated aqueduct points
  const nameToYear = new Map<string, number>()
  for (const aq of datedPoints) {
    // Normalize name for fuzzy matching
    const key = aq.name
      .toLowerCase()
      .replace(/aqua\s+/g, '')
      .trim()
    nameToYear.set(key, aq.constructionYear)
    // Also store full name
    nameToYear.set(aq.name.toLowerCase(), aq.constructionYear)
    // Store by city served
    if (aq.cityServed) {
      nameToYear.set(`city:${aq.cityServed.toLowerCase()}`, aq.constructionYear)
    }
  }

  let matchedByName = 0
  let correlated = 0
  let outside = 0

  const enriched = data.features.map((feature) => {
    // Try to match by name with dated point data
    const featureName = (feature.properties.name as string | undefined) || ''
    const nameKey = featureName
      .toLowerCase()
      .replace(/aqua\s+/g, '')
      .trim()

    let constructionYear: number | null = null
    if (nameKey && nameToYear.has(nameKey)) {
      constructionYear = nameToYear.get(nameKey)!
      matchedByName++
    } else if (nameKey && nameToYear.has(featureName.toLowerCase())) {
      constructionYear = nameToYear.get(featureName.toLowerCase())!
      matchedByName++
    }

    // Fall back to territory correlation
    const flatCoords = flattenToLineString(feature.geometry)
    const samplePts = sampleLinePoints(flatCoords)
    const { territoryYear, declineYear } = computeTerritoryYears(
      samplePts,
      sortedSnapshots,
      index.snapshotsByYear,
      index.sortedYears,
    )

    if (territoryYear !== null) correlated++
    else outside++

    return {
      ...feature,
      properties: {
        ...feature.properties,
        constructionYear,
        territoryYear,
        declineYear,
      },
    }
  })

  console.log(`  Matched by name: ${matchedByName}, Correlated: ${correlated}, Outside: ${outside}`)

  const output: FeatureCollection = { type: 'FeatureCollection', features: enriched }
  const outPath = resolvePath('../src/data/awmc-aqueducts-temporal.json')
  await writeFile(outPath, JSON.stringify(output) + '\n')
  console.log(`  ✓ Wrote ${outPath}`)
}

async function enrichTradeNetwork(
  sortedSnapshots: TerritorySnapshot[],
  index: ReturnType<typeof buildTerritoryIndex>,
) {
  console.log('\n── Trade Network (ORBIS) ──')
  const data = await loadJSON<TradeNetwork>('../src/data/trade/orbis.json')
  console.log(`  Sites: ${data.sites.length}, Routes: ${data.routes.length}`)

  // Enrich sites (point-based). Ports sit on the water's edge that the
  // coastline-clipped territory polygons trim off (Constantinople lands 3 km
  // outside every snapshot), so sample a ~10 km ring around each site too.
  let sitesCorrelated = 0
  let sitesOutside = 0

  const RING_KM = 10
  const enrichedSites = data.sites.map((site) => {
    const dLat = RING_KM / 111
    const dLng = RING_KM / (111 * Math.max(0.2, Math.cos((site.lat * Math.PI) / 180)))
    const samplePts: Position[] = [[site.lng, site.lat]]
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4
      samplePts.push([site.lng + dLng * Math.cos(a), site.lat + dLat * Math.sin(a)])
    }
    const { territoryYear, declineYear } = computeTerritoryYears(
      samplePts,
      sortedSnapshots,
      index.snapshotsByYear,
      index.sortedYears,
    )

    if (territoryYear !== null) sitesCorrelated++
    else sitesOutside++

    return { ...site, territoryYear, declineYear }
  })

  console.log(`  Sites — Correlated: ${sitesCorrelated}, Outside: ${sitesOutside}`)

  // Enrich routes (line-based)
  let routesCorrelated = 0
  let routesOutside = 0

  const enrichedRoutes = data.routes.map((route) => {
    if (!route.coordinates || route.coordinates.length < 2) {
      routesOutside++
      return { ...route, territoryYear: null, declineYear: null }
    }

    // Route coordinates are [lng, lat]
    const samplePts = sampleLinePoints(route.coordinates as Position[])
    const { territoryYear, declineYear } = computeTerritoryYears(
      samplePts,
      sortedSnapshots,
      index.snapshotsByYear,
      index.sortedYears,
    )

    if (territoryYear !== null) routesCorrelated++
    else routesOutside++

    return { ...route, territoryYear, declineYear }
  })

  console.log(`  Routes — Correlated: ${routesCorrelated}, Outside: ${routesOutside}`)

  // Second pass: derive temporal data for routes with null territoryYear from endpoints
  const siteLookup = new Map<string, (typeof enrichedSites)[number]>()
  for (const site of enrichedSites) {
    siteLookup.set(site.id, site)
  }

  let derivedFromEndpoints = 0
  const finalRoutes = enrichedRoutes.map((route) => {
    if (route.territoryYear != null) return route

    const fromSite = siteLookup.get(route.from)
    const toSite = siteLookup.get(route.to)
    const fromYear = fromSite?.territoryYear ?? null
    const toYear = toSite?.territoryYear ?? null
    const fromDecline = fromSite?.declineYear ?? null
    const toDecline = toSite?.declineYear ?? null

    let territoryYear: number | null = null
    if (fromYear != null && toYear != null) {
      // Roads require both endpoints under Roman control (built infrastructure)
      // Sea/river routes activate when either endpoint is Roman (pre-existing trade)
      territoryYear =
        route.transportType === 'road' ? Math.max(fromYear, toYear) : Math.min(fromYear, toYear)
    } else if (fromYear != null) {
      territoryYear = fromYear
    } else if (toYear != null) {
      territoryYear = toYear
    }

    let declineYear: number | null = null
    if (fromDecline != null && toDecline != null) {
      declineYear = Math.min(fromDecline, toDecline)
    } else if (fromDecline != null) {
      declineYear = fromDecline
    } else if (toDecline != null) {
      declineYear = toDecline
    }

    if (territoryYear != null) derivedFromEndpoints++

    return { ...route, territoryYear, declineYear }
  })

  console.log(`  Routes — Derived from endpoints: ${derivedFromEndpoints}`)

  const output: TradeNetwork = { sites: enrichedSites, routes: finalRoutes }
  const outPath = resolvePath('../src/data/trade/orbis-temporal.json')
  await writeFile(outPath, JSON.stringify(output) + '\n')
  console.log(`  ✓ Wrote ${outPath}`)
}

async function enrichPointData(
  label: string,
  inputPath: string,
  sortedSnapshots: TerritorySnapshot[],
  index: ReturnType<typeof buildTerritoryIndex>,
) {
  console.log(`\n── ${label} ──`)
  const data = await loadJSON<PointRecord[]>(inputPath)
  console.log(`  Records: ${data.length}`)

  let alreadyDated = 0
  let correlated = 0
  let outside = 0

  const enriched = data.map((record) => {
    const startYear = record.startYear ?? 0
    // Skip records that already have dates
    if (startYear !== 0) {
      alreadyDated++
      return record
    }

    const samplePts: Position[] = [[record.lng, record.lat]]
    const { territoryYear, declineYear } = computeTerritoryYears(
      samplePts,
      sortedSnapshots,
      index.snapshotsByYear,
      index.sortedYears,
    )

    if (territoryYear !== null) correlated++
    else outside++

    return { ...record, territoryYear, declineYear }
  })

  console.log(`  Already dated: ${alreadyDated}, Correlated: ${correlated}, Outside: ${outside}`)

  const outPath = resolvePath(inputPath)
  await writeFile(outPath, JSON.stringify(enriched) + '\n')
  console.log(`  ✓ Updated ${outPath}`)
}

async function enrichPelagiosPlaces(
  sortedSnapshots: TerritorySnapshot[],
  index: ReturnType<typeof buildTerritoryIndex>,
) {
  console.log('\n── Pelagios Places ──')
  const data = await loadJSON<PointRecord[]>('../src/data/pelagios-places.json')
  console.log(`  Records: ${data.length}`)

  // Pelagios has no startYear/endYear fields, so enrich all records
  let correlated = 0
  let outside = 0

  const enriched = data.map((record) => {
    const samplePts: Position[] = [[record.lng, record.lat]]
    const { territoryYear, declineYear } = computeTerritoryYears(
      samplePts,
      sortedSnapshots,
      index.snapshotsByYear,
      index.sortedYears,
    )

    if (territoryYear !== null) correlated++
    else outside++

    return { ...record, territoryYear, declineYear }
  })

  console.log(`  Correlated: ${correlated}, Outside: ${outside}`)

  const outPath = resolvePath('../src/data/pelagios-places.json')
  await writeFile(outPath, JSON.stringify(enriched) + '\n')
  console.log(`  ✓ Updated ${outPath}`)
}

// ── Main ──

async function main() {
  console.log('Enriching data layers with temporal properties...')

  const argStages = new Set(process.argv.slice(2))
  const run = (stage: string) => argStages.size === 0 || argStages.has(stage)

  const territories = await loadJSON<TerritorySnapshot[]>(
    '../src/data/territories/territories.json',
  )
  // 'lost' snapshots carry the fallen empire's final extent — exclude them
  // so features decline when control ends, not against a ghost boundary.
  const sortedSnapshots = territories
    .filter((s) => s.status !== 'lost')
    .sort((a, b) => a.year - b.year)
  const index = buildTerritoryIndex(sortedSnapshots)

  console.log(`  Territory snapshots: ${sortedSnapshots.length}`)
  console.log(`  Years: ${index.sortedYears.join(', ')}`)

  // Phase 1: Quick Wins
  if (run('fortifications')) await enrichFortifications(sortedSnapshots, index)
  if (run('aqueducts')) await enrichAqueductLines(sortedSnapshots, index)
  if (run('trade')) await enrichTradeNetwork(sortedSnapshots, index)

  // Phase 2: Large Undated Datasets (rewrite their input files in place)
  if (run('points')) {
    await enrichPointData(
      'DARE Settlements (undated)',
      '../src/data/dare/settlements.json',
      sortedSnapshots,
      index,
    )
    await enrichPointData(
      'Vici Sites (undated)',
      '../src/data/vici-sites.json',
      sortedSnapshots,
      index,
    )
    await enrichPointData(
      'DARMC Places (undated)',
      '../src/data/darmc-places.json',
      sortedSnapshots,
      index,
    )
    await enrichPointData(
      'IDAI Sites (undated)',
      '../src/data/idai-sites.json',
      sortedSnapshots,
      index,
    )
    await enrichPelagiosPlaces(sortedSnapshots, index)
  }

  console.log('\n✓ Layers enriched.')
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
