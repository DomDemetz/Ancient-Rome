/**
 * Enriches DARE and Itiner-e road GeoJSON with temporal properties
 * by spatially correlating road segments against territory snapshots.
 *
 * For each road segment, samples 3 points along it (25%, 50%, 75%)
 * and finds the earliest territory snapshot containing any sample point,
 * plus the first later snapshot where it falls outside territory.
 *
 * Usage: npx tsx scripts/enrich-roads-temporal.ts
 */

import { readFile, writeFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import length from '@turf/length'
import along from '@turf/along'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { lineString, point } from '@turf/helpers'
import type { Feature, MultiPolygon, Position } from 'geojson'
import { getAttestedYear } from '../src/data/named-roads.js'

// ── Types ──

interface TerritorySnapshot {
  id: string
  year: number
  status?: string
  boundaries: Feature<MultiPolygon>
}

interface RoadFeature {
  type: 'Feature'
  properties: Record<string, unknown>
  geometry: {
    type: string
    coordinates: number[][][] | number[][]
  }
}

interface FeatureCollection {
  type: 'FeatureCollection'
  features: RoadFeature[]
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
function flattenToLineString(feature: RoadFeature): Position[] {
  const coords = feature.geometry.coordinates
  if (feature.geometry.type === 'MultiLineString') {
    // coords is number[][][]
    const allPoints: Position[] = []
    for (const line of coords as number[][][]) {
      allPoints.push(...line)
    }
    return allPoints
  }
  // LineString: coords is number[][]
  return coords as number[][]
}

/**
 * Sample 3 points along a road at 25%, 50%, 75% of total length.
 */
function samplePoints(flatCoords: Position[]): Position[] {
  if (flatCoords.length < 2) return []

  try {
    const line = lineString(flatCoords)
    const totalLength = length(line, { units: 'kilometers' })
    if (totalLength === 0) return []

    const points: Position[] = []
    for (const frac of [0.25, 0.5, 0.75]) {
      const dist = totalLength * frac
      const pt = along(line, dist, { units: 'kilometers' })
      points.push(pt.geometry.coordinates)
    }
    return points
  } catch {
    return []
  }
}

/**
 * Check if any sample point falls inside any territory polygon for a given snapshot.
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

// ── Main ──

async function main() {
  console.log('Enriching roads with temporal data...\n')

  // Load data
  const [dareRoads, itinereRoads, territories] = await Promise.all([
    loadJSON<FeatureCollection>('../src/data/dare/roads.json'),
    loadJSON<FeatureCollection>('../src/data/itinere/roads.json'),
    loadJSON<TerritorySnapshot[]>('../src/data/territories/territories.json'),
  ])

  // 'lost' snapshots carry the fallen empire's final extent — exclude them
  // so roads decline when control ends, not against a ghost boundary.
  const sortedSnapshots = territories
    .filter((s) => s.status !== 'lost')
    .sort((a, b) => a.year - b.year)

  console.log(`  DARE roads: ${dareRoads.features.length}`)
  console.log(`  Itiner-e roads: ${itinereRoads.features.length}`)
  console.log(`  Territory snapshots: ${sortedSnapshots.length}\n`)

  // ── Enrich function ──

  function computeSpatialTemporal(feature: RoadFeature): {
    territoryYear: number | null
    declineYear: number | null
  } {
    const flatCoords = flattenToLineString(feature)
    const samplePts = samplePoints(flatCoords)

    if (samplePts.length === 0) {
      return { territoryYear: null, declineYear: null }
    }

    // Find earliest snapshot where road is inside territory
    let territoryYear: number | null = null
    let firstInsideIdx = -1

    for (let i = 0; i < sortedSnapshots.length; i++) {
      if (isInsideTerritory(samplePts, sortedSnapshots[i])) {
        territoryYear = sortedSnapshots[i].year
        firstInsideIdx = i
        break
      }
    }

    if (territoryYear === null) {
      return { territoryYear: null, declineYear: null }
    }

    // Decline = first year outside ALL territory AFTER the last year inside.
    // Territory can be lost and recovered (Gallic Empire 261-283, Justinian's
    // reconquests), so the first outside year is not the decline — the road
    // declines only once control never returns.
    let declineYear: number | null = null

    // Group snapshots by year from firstInsideIdx onward
    const yearsSeen = new Set<number>()
    const snapshotsByYear = new Map<number, TerritorySnapshot[]>()

    for (let i = firstInsideIdx; i < sortedSnapshots.length; i++) {
      const snap = sortedSnapshots[i]
      yearsSeen.add(snap.year)
      if (!snapshotsByYear.has(snap.year)) {
        snapshotsByYear.set(snap.year, [])
      }
      snapshotsByYear.get(snap.year)!.push(snap)
    }

    const years = [...yearsSeen].sort((a, b) => a - b)

    // Skip the first year (we know it's inside); track the outside year that
    // follows the LAST inside year.
    for (let yi = 1; yi < years.length; yi++) {
      const yearSnapshots = snapshotsByYear.get(years[yi])!
      const insideAny = yearSnapshots.some((snap) => isInsideTerritory(samplePts, snap))
      if (insideAny) {
        declineYear = null
      } else if (declineYear === null) {
        declineYear = years[yi]
      }
    }

    return { territoryYear, declineYear }
  }

  // ── Process DARE roads ──

  let dareNamed = 0
  let dareCorrelated = 0
  let dareOutside = 0

  const dareEnriched = dareRoads.features.map((feature) => {
    const name = feature.properties.name as string | undefined
    const attestedYear = name ? getAttestedYear(name) : null
    const isNamed = attestedYear !== null

    if (isNamed) dareNamed++

    const { territoryYear, declineYear } = computeSpatialTemporal(feature)

    if (territoryYear !== null) {
      dareCorrelated++
    } else {
      dareOutside++
    }

    return {
      ...feature,
      properties: {
        ...feature.properties,
        attestedYear,
        isNamed,
        territoryYear,
        declineYear,
      },
    }
  })

  console.log(
    `  DARE — Named: ${dareNamed}, Correlated: ${dareCorrelated}, Outside: ${dareOutside}`,
  )

  // ── Process Itiner-e roads ──

  let itinerePreserved = 0
  let itinereCorrelated = 0
  let itinereOutside = 0

  const itinereEnriched = itinereRoads.features.map((feature) => {
    const startYear = feature.properties.startYear as number

    // Roads with existing startYear !== 0 preserve their dates
    if (startYear !== 0) {
      itinerePreserved++
      return {
        ...feature,
        properties: {
          ...feature.properties,
          attestedYear: null,
          isNamed: false,
          territoryYear: null,
          declineYear: null,
        },
      }
    }

    const { territoryYear, declineYear } = computeSpatialTemporal(feature)

    if (territoryYear !== null) {
      itinereCorrelated++
    } else {
      itinereOutside++
    }

    return {
      ...feature,
      properties: {
        ...feature.properties,
        attestedYear: null,
        isNamed: false,
        territoryYear,
        declineYear,
      },
    }
  })

  console.log(
    `  Itiner-e — Preserved: ${itinerePreserved}, Correlated: ${itinereCorrelated}, Outside: ${itinereOutside}`,
  )

  // ── Write output ──

  const dareOut: FeatureCollection = { type: 'FeatureCollection', features: dareEnriched }
  const itinereOut: FeatureCollection = { type: 'FeatureCollection', features: itinereEnriched }

  const darePath = resolvePath('../src/data/dare/roads-temporal.json')
  const itinerePath = resolvePath('../src/data/itinere/roads-temporal.json')

  await Promise.all([
    writeFile(darePath, JSON.stringify(dareOut) + '\n'),
    writeFile(itinerePath, JSON.stringify(itinereOut) + '\n'),
  ])

  console.log(`\n  ✓ Wrote ${darePath}`)
  console.log(`  ✓ Wrote ${itinerePath}`)
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
