/**
 * upgrade-territories.ts
 *
 * Enhances territory boundaries in territories.json using high-quality
 * AWMC (Ancient World Mapping Center) empire extent data.
 *
 * - Adds 2 new snapshots: year -60 (Late Republic) and year 117 (Trajan's peak)
 * - Replaces boundaries for years -100, 100, 200 with AWMC data
 * - Keeps all other snapshots unchanged
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const TERRITORIES_PATH = path.join(ROOT, 'src/data/territories/territories.json')
const AWMC_PATH = path.join(ROOT, 'src/data/awmc-features.json')

interface TerritorySnapshot {
  id: string
  year: number
  controlledBy: string
  status: string
  label: string
  boundaries: {
    type: 'Feature'
    properties: { name: string }
    geometry: {
      type: 'MultiPolygon'
      coordinates: number[][][][]
    }
  }
}

interface AWMCFeature {
  type: string
  properties: {
    awmc_type: string
    [key: string]: unknown
  }
  geometry: {
    type: 'Polygon'
    coordinates: number[][][]
  }
}

interface AWMCFeatureCollection {
  type: string
  features: AWMCFeature[]
}

// Truncate a coordinate to 4 decimal places
function truncCoord(n: number): number {
  return Math.round(n * 10000) / 10000
}

// Truncate all coordinates in a MultiPolygon coordinates array
function truncateCoords(coords: number[][][][]): number[][][][] {
  return coords.map((polygon) => polygon.map((ring) => ring.map((pt) => pt.map(truncCoord))))
}

// Merge an array of AWMC Polygon features into a single MultiPolygon coordinate array
function mergePolygonsToMultiPolygon(features: AWMCFeature[]): number[][][][] {
  const coords: number[][][][] = []
  for (const f of features) {
    if (f.geometry.type === 'Polygon') {
      coords.push(f.geometry.coordinates)
    }
  }
  return coords
}

function main() {
  console.log('Reading territories.json...')
  const territories: TerritorySnapshot[] = JSON.parse(fs.readFileSync(TERRITORIES_PATH, 'utf-8'))
  console.log(`  Found ${territories.length} snapshots`)

  console.log('Reading awmc-features.json...')
  const awmc: AWMCFeatureCollection = JSON.parse(fs.readFileSync(AWMC_PATH, 'utf-8'))
  console.log(`  Found ${awmc.features.length} features total`)

  // Extract the 3 empire extents
  const extent60bce = awmc.features.filter((f) => f.properties.awmc_type === 'empire_extent_60bce')
  const extent117ce = awmc.features.filter((f) => f.properties.awmc_type === 'empire_extent_117ce')
  const extent200ce = awmc.features.filter((f) => f.properties.awmc_type === 'empire_extent_200ce')

  console.log(`  empire_extent_60bce: ${extent60bce.length} polygons`)
  console.log(`  empire_extent_117ce: ${extent117ce.length} polygons`)
  console.log(`  empire_extent_200ce: ${extent200ce.length} polygons`)

  // Merge each into a MultiPolygon
  const multiPoly60bce = truncateCoords(mergePolygonsToMultiPolygon(extent60bce))
  const multiPoly117ce = truncateCoords(mergePolygonsToMultiPolygon(extent117ce))
  const multiPoly200ce = truncateCoords(mergePolygonsToMultiPolygon(extent200ce))

  // Helper to create a boundary Feature
  function makeBoundary(
    name: string,
    coordinates: number[][][][],
  ): TerritorySnapshot['boundaries'] {
    return {
      type: 'Feature',
      properties: { name },
      geometry: {
        type: 'MultiPolygon',
        coordinates,
      },
    }
  }

  // 1. Add 2 NEW snapshots
  const newSnapshot60: TerritorySnapshot = {
    id: 'rome',
    year: -60,
    controlledBy: 'roman-republic',
    status: 'controlled',
    label: 'Roman Republic — 60 BC',
    boundaries: makeBoundary('Roman Republic — 60 BC', multiPoly60bce),
  }

  const newSnapshot117: TerritorySnapshot = {
    id: 'rome',
    year: 117,
    controlledBy: 'trajan',
    status: 'controlled',
    label: 'Roman Empire — 117 AD (Peak)',
    boundaries: makeBoundary('Roman Empire — 117 AD (Peak)', multiPoly117ce),
  }

  territories.push(newSnapshot60, newSnapshot117)
  console.log('\nAdded new snapshots: year -60, year 117')

  // 2. Replace boundaries for closest existing snapshots
  let replacedCount = 0
  for (const t of territories) {
    if (t.year === -100) {
      t.boundaries = makeBoundary(t.label, multiPoly60bce)
      console.log(`Replaced year -100 boundary with AWMC 60 BCE data`)
      replacedCount++
    } else if (t.year === 100) {
      t.boundaries = makeBoundary(t.label, multiPoly117ce)
      console.log(`Replaced year 100 boundary with AWMC 117 CE data`)
      replacedCount++
    } else if (t.year === 200) {
      t.boundaries = makeBoundary(t.label, multiPoly200ce)
      console.log(`Replaced year 200 boundary with AWMC 200 CE data`)
      replacedCount++
    }
  }
  console.log(`Replaced ${replacedCount} existing snapshot boundaries`)

  // 3. Sort by year
  territories.sort((a, b) => a.year - b.year)

  // 4. Write back
  const output = JSON.stringify(territories, null, 2)
  fs.writeFileSync(TERRITORIES_PATH, output, 'utf-8')

  const fileSizeKB = (Buffer.byteLength(output, 'utf-8') / 1024).toFixed(1)
  console.log(`\nWrote ${territories.length} snapshots to territories.json (${fileSizeKB} KB)`)

  // Summary
  console.log('\nFinal snapshots:')
  for (const t of territories) {
    const polyCount = t.boundaries.geometry.coordinates.length
    console.log(`  year ${t.year}: ${t.label} (${polyCount} polygons)`)
  }
}

main()
