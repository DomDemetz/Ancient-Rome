/**
 * Script to fetch and process Itiner-e road data from Zenodo.
 * Generates a compact GeoJSON with temporal data for timeline filtering.
 *
 * The source data is in EPSG:3395 (World Mercator) — we reproject to WGS84.
 *
 * Usage: npx tsx scripts/generate-itinere-roads.ts
 *
 * Source: https://zenodo.org/records/17122148
 * License: CC-BY-NC 4.0
 */

import { writeFile, mkdir } from 'fs/promises'
import { fileURLToPath } from 'url'
import proj4 from 'proj4'

const ITINERE_URL = 'https://zenodo.org/api/records/17122148/files/itinere_roads.geojson/content'

// EPSG:3395 (World Mercator) definition
proj4.defs(
  'EPSG:3395',
  '+proj=merc +lon_0=0 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs +type=crs',
)

interface RawFeature {
  type: 'Feature'
  properties: Record<string, unknown>
  geometry: {
    type: string
    coordinates: unknown
  }
}

interface RawCollection {
  type: 'FeatureCollection'
  features: RawFeature[]
}

// ── Coordinate helpers ──

function truncateCoord(n: number): number {
  return Math.round(n * 10000) / 10000
}

/** Reproject a single [x, y, z?] from EPSG:3395 to WGS84 [lng, lat] */
function reprojectPoint(coord: number[]): [number, number] {
  const [lng, lat] = proj4('EPSG:3395', 'WGS84', [coord[0], coord[1]])
  return [truncateCoord(lng), truncateCoord(lat)]
}

function reprojectLineString(coords: number[][]): number[][] {
  return coords.map(reprojectPoint)
}

function reprojectMultiLineString(coords: number[][][]): number[][][] {
  return coords.map(reprojectLineString)
}

// ── Douglas-Peucker line simplification (operates on reprojected WGS84 coords) ──

type Point = [number, number]

function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd[0] - lineStart[0]
  const dy = lineEnd[1] - lineStart[1]
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) {
    const ex = point[0] - lineStart[0]
    const ey = point[1] - lineStart[1]
    return Math.sqrt(ex * ex + ey * ey)
  }
  const t = ((point[0] - lineStart[0]) * dx + (point[1] - lineStart[1]) * dy) / lenSq
  const projX = lineStart[0] + t * dx
  const projY = lineStart[1] + t * dy
  const ex = point[0] - projX
  const ey = point[1] - projY
  return Math.sqrt(ex * ex + ey * ey)
}

function douglasPeucker(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points

  let maxDist = 0
  let maxIdx = 0
  const end = points.length - 1

  for (let i = 1; i < end; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[end])
    if (dist > maxDist) {
      maxDist = dist
      maxIdx = i
    }
  }

  if (maxDist > tolerance) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), tolerance)
    const right = douglasPeucker(points.slice(maxIdx), tolerance)
    return [...left.slice(0, -1), ...right]
  }

  return [points[0], points[end]]
}

function simplifyLineString(coords: number[][], tolerance: number): number[][] {
  return douglasPeucker(coords as Point[], tolerance) as number[][]
}

function simplifyMultiLineString(coords: number[][][], tolerance: number): number[][][] {
  return coords.map((line) => simplifyLineString(line, tolerance))
}

// ── Property mapping ──

function mapType(raw: unknown): 'main' | 'secondary' {
  return String(raw).toLowerCase() === 'main' ? 'main' : 'secondary'
}

function mapCertainty(raw: unknown): 'certain' | 'conjectured' | 'hypothetical' {
  const val = String(raw).toLowerCase()
  if (val.startsWith('certain')) return 'certain'
  if (val.startsWith('conject')) return 'conjectured'
  return 'hypothetical'
}

function mapDate(raw: unknown): number {
  const n = parseInt(String(raw), 10)
  if (isNaN(n) || n === 9999) return 0
  return n
}

// ── Main ──

async function main() {
  console.log('Generating Itiner-e road layer...\n')

  console.log(`  Fetching ${ITINERE_URL}...`)
  const res = await fetch(ITINERE_URL)
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`)
  const raw = (await res.json()) as RawCollection
  console.log(`  Downloaded ${raw.features.length} features`)

  // Tolerance in degrees (~500m at equator)
  const TOLERANCE = 0.005
  let totalPointsBefore = 0
  let totalPointsAfter = 0

  const features = raw.features
    .filter((f) => {
      const t = f.geometry?.type
      return t === 'LineString' || t === 'MultiLineString'
    })
    .map((f) => {
      const props = f.properties || {}

      // Reproject from EPSG:3395 to WGS84, then simplify
      let coordinates: unknown
      if (f.geometry.type === 'LineString') {
        const reprojected = reprojectLineString(f.geometry.coordinates as number[][])
        totalPointsBefore += reprojected.length
        const simplified = simplifyLineString(reprojected, TOLERANCE)
        totalPointsAfter += simplified.length
        coordinates = simplified
      } else {
        const reprojected = reprojectMultiLineString(f.geometry.coordinates as number[][][])
        for (const line of reprojected) totalPointsBefore += line.length
        const simplified = simplifyMultiLineString(reprojected, TOLERANCE)
        for (const line of simplified) totalPointsAfter += line.length
        coordinates = simplified
      }

      const mapped: Record<string, unknown> = {}
      if (props.Name) mapped.name = String(props.Name)
      mapped.type = mapType(props.Type)
      mapped.certainty = mapCertainty(props.Cons_per_e)
      mapped.startYear = mapDate(props.Lower_Date)
      mapped.endYear = mapDate(props.Upper_Date)
      if (props.Segment_s) mapped.builder = String(props.Segment_s)

      return {
        type: 'Feature' as const,
        properties: mapped,
        geometry: {
          type: f.geometry.type,
          coordinates,
        },
      }
    })

  const collection = { type: 'FeatureCollection' as const, features }
  const json = JSON.stringify(collection)

  // Ensure output directory exists
  const outDir = fileURLToPath(new URL('../src/data/itinere', import.meta.url))
  await mkdir(outDir, { recursive: true })

  const outPath = fileURLToPath(new URL('../src/data/itinere/roads.json', import.meta.url))
  await writeFile(outPath, json + '\n')

  const reduction = ((1 - totalPointsAfter / totalPointsBefore) * 100).toFixed(1)
  console.log(`  Points: ${totalPointsBefore} → ${totalPointsAfter} (${reduction}% reduction)`)
  console.log(
    `  ✓ Itiner-e Roads: ${features.length} features, ${(json.length / 1024 / 1024).toFixed(1)} MB`,
  )
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
