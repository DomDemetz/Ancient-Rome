/**
 * Script to ingest DARMC (Digital Atlas of the Roman and Medieval Civilizations)
 * datasets from Harvard Dataverse.
 *
 * Datasets ingested:
 * 1. Roman Road Network (doi:10.7910/DVN/TI0KAU) - shapefile → road segments
 * 2. Ancient Ports and Harbours (doi:10.7910/DVN/3KQFUT) - Excel → point data
 * 3. Roman/Post-Roman Climate Evidence (doi:10.7910/DVN/TVXATE) - Excel → point data
 *
 * Usage: npx tsx scripts/ingest-darmc.ts
 */

import { writeFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'
import * as XLSX from 'xlsx'
import proj4 from 'proj4'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const DATA_DIR = join(__dirname, '..', 'src', 'data')

// Harvard Dataverse file download base URL
const DATAVERSE_FILE_URL = 'https://dataverse.harvard.edu/api/access/datafile'

// DARMC Roman Roads projection: Europe Lambert Conformal Conic (European 1950 datum)
const DARMC_ROADS_PROJ =
  '+proj=lcc +lat_1=43 +lat_2=62 +lat_0=30 +lon_0=10 +x_0=0 +y_0=0 +ellps=intl +datum=WGS84 +units=m +no_defs'

// ─── Interfaces ────────────────────────────────────────────────────────────────

interface DarmcPlace {
  id: string
  name: string
  lat: number
  lng: number
  placeType: string
  startYear: number | null
  endYear: number | null
  description: string
  source: 'DARMC'
}

interface RoadSegment {
  id: string
  name: string
  coordinates: [number, number][]
  source: 'DARMC'
}

// ─── Utility Functions ─────────────────────────────────────────────────────────

function toKebabCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .replace(/-+/g, '-')
}

function isValidCoord(lat: number, lng: number): boolean {
  return (
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  )
}

async function downloadFile(fileId: number, filename: string): Promise<Buffer | null> {
  const url = `${DATAVERSE_FILE_URL}/${fileId}`
  console.log(`  Downloading ${filename} from ${url}...`)
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.log(`    Failed: HTTP ${res.status}`)
      return null
    }
    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    console.log(`    Downloaded ${(buffer.length / 1024).toFixed(1)} KB`)
    return buffer
  } catch (err) {
    console.log(`    Error: ${err}`)
    return null
  }
}

// ─── Shapefile DBF Parser ──────────────────────────────────────────────────────
// Minimal .dbf parser for dBASE III files

interface DbfRecord {
  [key: string]: string | number | null
}

function parseDbf(buffer: Buffer): DbfRecord[] {
  const records: DbfRecord[] = []

  // Header
  const numRecords = buffer.readUInt32LE(4)
  const headerSize = buffer.readUInt16LE(8)
  const recordSize = buffer.readUInt16LE(10)

  // Field descriptors start at byte 32, each is 32 bytes, terminated by 0x0D
  const fields: Array<{ name: string; type: string; length: number; decimalCount: number }> = []
  let offset = 32
  while (offset < headerSize - 1 && buffer[offset] !== 0x0d) {
    const name = buffer
      .subarray(offset, offset + 11)
      .toString('ascii')
      .replace(/\0/g, '')
      .trim()
    const type = String.fromCharCode(buffer[offset + 11])
    const length = buffer[offset + 16]
    const decimalCount = buffer[offset + 17]
    fields.push({ name, type, length, decimalCount })
    offset += 32
  }

  console.log(`    DBF fields: ${fields.map((f) => `${f.name}(${f.type})`).join(', ')}`)

  // Records start after header
  let recordOffset = headerSize
  for (let i = 0; i < numRecords; i++) {
    // First byte is deletion flag
    const deleted = buffer[recordOffset] === 0x2a
    if (deleted) {
      recordOffset += recordSize
      continue
    }

    const record: DbfRecord = {}
    let fieldOffset = recordOffset + 1

    for (const field of fields) {
      const raw = buffer
        .subarray(fieldOffset, fieldOffset + field.length)
        .toString('ascii')
        .trim()
      if (field.type === 'N' || field.type === 'F') {
        const num = parseFloat(raw)
        record[field.name] = isNaN(num) ? null : num
      } else {
        record[field.name] = raw || null
      }
      fieldOffset += field.length
    }

    records.push(record)
    recordOffset += recordSize
  }

  return records
}

// ─── Shapefile SHP Parser ──────────────────────────────────────────────────────
// Minimal .shp parser for polyline/point shapes

interface ShpPolyline {
  parts: Array<[number, number][]>
}

function parseShpPolylines(buffer: Buffer): ShpPolyline[] {
  const shapes: ShpPolyline[] = []

  // File header is 100 bytes
  let offset = 100

  while (offset < buffer.length - 8) {
    // Record header: record number (4 bytes BE), content length (4 bytes BE)
    const contentLength = buffer.readUInt32BE(offset + 4) * 2 // in 16-bit words
    const recordStart = offset + 8

    if (recordStart + 4 > buffer.length) break

    const shapeType = buffer.readInt32LE(recordStart)

    if (shapeType === 3 || shapeType === 5) {
      // PolyLine (3) or Polygon (5)
      // Bounding box: 4 doubles (32 bytes) starting at recordStart + 4
      const numParts = buffer.readInt32LE(recordStart + 36)
      const numPoints = buffer.readInt32LE(recordStart + 40)

      // Part indices
      const partIndices: number[] = []
      for (let i = 0; i < numParts; i++) {
        partIndices.push(buffer.readInt32LE(recordStart + 44 + i * 4))
      }

      // Points start after part indices
      const pointsStart = recordStart + 44 + numParts * 4
      const allPoints: [number, number][] = []
      for (let i = 0; i < numPoints; i++) {
        const x = buffer.readDoubleLE(pointsStart + i * 16) // longitude
        const y = buffer.readDoubleLE(pointsStart + i * 16 + 8) // latitude
        allPoints.push([y, x]) // [lat, lng]
      }

      // Split into parts
      const parts: Array<[number, number][]> = []
      for (let p = 0; p < numParts; p++) {
        const start = partIndices[p]
        const end = p < numParts - 1 ? partIndices[p + 1] : numPoints
        parts.push(allPoints.slice(start, end))
      }

      shapes.push({ parts })
    } else if (shapeType === 0) {
      // Null shape, skip
    }

    offset += 8 + contentLength
  }

  return shapes
}

// ─── Dataset 1: Roman Roads ────────────────────────────────────────────────────

async function ingestRomanRoads(): Promise<RoadSegment[]> {
  console.log('\n=== Ingesting Roman Road Network ===')

  // Download .dbf file (attributes) and .shp file (geometries)
  const [dbfBuffer, shpBuffer] = await Promise.all([
    downloadFile(2446013, 'roman_roads_v2008.dbf'),
    downloadFile(2446019, 'roman_roads_v2008.shp'),
  ])

  if (!dbfBuffer) {
    console.log('  Failed to download DBF file')
    return []
  }

  // Parse DBF for road attributes
  const dbfRecords = parseDbf(dbfBuffer)
  console.log(`  Parsed ${dbfRecords.length} road records from DBF`)

  const roads: RoadSegment[] = []

  if (shpBuffer) {
    // Parse SHP for geometries
    const shapes = parseShpPolylines(shpBuffer)
    console.log(`  Parsed ${shapes.length} polyline shapes from SHP`)

    // Combine attributes with geometries
    const count = Math.min(dbfRecords.length, shapes.length)

    // The SHP uses Lambert Conformal Conic projection - convert to WGS84
    for (let i = 0; i < count; i++) {
      const record = dbfRecords[i]
      const shape = shapes[i]

      // Road class from DBF
      const roadClass = String(record['CLASS'] || 'Road').trim()

      for (let p = 0; p < shape.parts.length; p++) {
        const rawCoords = shape.parts[p]
        if (rawCoords.length < 2) continue

        // Convert from Lambert Conformal Conic to WGS84 [lat, lng]
        const coords: [number, number][] = []
        for (const [projLat, projLng] of rawCoords) {
          try {
            // proj4 expects [x, y] = [easting, northing] = [lng-like, lat-like]
            const [lng, lat] = proj4(DARMC_ROADS_PROJ, 'EPSG:4326', [projLng, projLat])
            if (isValidCoord(lat, lng)) {
              coords.push([Math.round(lat * 10000) / 10000, Math.round(lng * 10000) / 10000])
            }
          } catch {
            // Skip invalid coordinates
          }
        }

        if (coords.length < 2) continue

        // Downsample long segments to keep file size manageable
        const simplified = simplifyCoords(coords, 0.01) // ~1km resolution

        roads.push({
          id: `darmc-road-${i}-${p}`,
          name: roadClass,
          coordinates: simplified,
          source: 'DARMC',
        })
      }
    }
  } else {
    console.log('  No SHP file - extracting what we can from DBF only')
  }

  console.log(`  Total road segments: ${roads.length}`)
  return roads
}

function simplifyCoords(coords: [number, number][], tolerance: number): [number, number][] {
  if (coords.length <= 2) return coords

  // Douglas-Peucker simplification
  let maxDist = 0
  let maxIdx = 0
  const start = coords[0]
  const end = coords[coords.length - 1]

  for (let i = 1; i < coords.length - 1; i++) {
    const d = perpendicularDist(coords[i], start, end)
    if (d > maxDist) {
      maxDist = d
      maxIdx = i
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyCoords(coords.slice(0, maxIdx + 1), tolerance)
    const right = simplifyCoords(coords.slice(maxIdx), tolerance)
    return [...left.slice(0, -1), ...right]
  }

  return [start, end]
}

function perpendicularDist(
  point: [number, number],
  lineStart: [number, number],
  lineEnd: [number, number],
): number {
  const [py, px] = point
  const [sy, sx] = lineStart
  const [ey, ex] = lineEnd

  const dx = ex - sx
  const dy = ey - sy
  const lenSq = dx * dx + dy * dy

  if (lenSq === 0) return Math.sqrt((px - sx) ** 2 + (py - sy) ** 2)

  const t = Math.max(0, Math.min(1, ((px - sx) * dx + (py - sy) * dy) / lenSq))
  const projX = sx + t * dx
  const projY = sy + t * dy

  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2)
}

// ─── Dataset 2: Ancient Ports and Harbours ─────────────────────────────────────

async function ingestAncientPorts(): Promise<DarmcPlace[]> {
  console.log('\n=== Ingesting Ancient Ports and Harbours ===')

  const buffer = await downloadFile(
    2453917,
    'A de Graauw 2014 - Geodatabase of Ancient Ports and Harbors (v 1-1).xlsx',
  )

  if (!buffer) {
    console.log('  Failed to download Excel file')
    return []
  }

  const workbook = XLSX.read(buffer, { type: 'buffer' })
  console.log(`  Sheets: ${workbook.SheetNames.join(', ')}`)

  const places: DarmcPlace[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

    if (rows.length === 0) continue

    // Skip non-data sheets
    if (sheetName.toLowerCase().includes('read me') || sheetName.toLowerCase().includes('key')) {
      continue
    }

    console.log(`  Processing sheet "${sheetName}": ${rows.length} rows`)

    for (const row of rows) {
      // The PLACES sheet uses LATITUDE / LONGITUDE columns
      const lat = parseFloat(String(row['LATITUDE'] || row['Latitude'] || row['lat'] || ''))
      const lng = parseFloat(String(row['LONGITUDE'] || row['Longitude'] || row['lon'] || ''))

      if (!isValidCoord(lat, lng)) continue

      const name = String(row['NAME'] || row['Name'] || row['name'] || '').trim()
      if (!name) continue

      // Determine port type from coded columns:
      // AM=anchorage, PP=port, RE=river entry, BW=breakwater, etc.
      let placeType = 'port'
      const am = String(row['AM'] || '').trim()
      const pp = String(row['PP'] || '').trim()
      if (am && !pp) placeType = 'anchorage'
      else if (pp) placeType = 'port'
      else placeType = 'harbour'

      const ancientAuth = String(row['AUTH_ANC'] || '').trim()
      const country = String(row['COUNTRY'] || '').trim()

      const descParts: string[] = [`Ancient ${placeType}: ${name}`]
      if (country) descParts.push(`(${country})`)
      if (ancientAuth) descParts.push(`Sources: ${ancientAuth.substring(0, 120)}`)

      const id = `darmc-port-${toKebabCase(name)}-${Math.round(lat * 100)}-${Math.round(lng * 100)}`

      places.push({
        id,
        name,
        lat: Math.round(lat * 10000) / 10000,
        lng: Math.round(lng * 10000) / 10000,
        placeType,
        startYear: null,
        endYear: null,
        description: descParts.join('. '),
        source: 'DARMC',
      })
    }

    if (places.length > 0) break
  }

  console.log(`  Extracted ${places.length} ports/harbours`)
  return places
}

function parseOptionalYear(val: unknown): number | null {
  if (val === undefined || val === null || val === '') return null
  const num = parseInt(String(val), 10)
  if (isNaN(num)) {
    // Try parsing "100 BC" style
    const str = String(val).trim()
    const bcMatch = str.match(/^(\d+)\s*BC$/i)
    if (bcMatch) return -parseInt(bcMatch[1], 10)
    const adMatch = str.match(/^(\d+)\s*AD$/i)
    if (adMatch) return parseInt(adMatch[1], 10)
    return null
  }
  if (num < -3000 || num > 2000) return null
  return num
}

// ─── Dataset 3: Roman/Post-Roman Climate Evidence ──────────────────────────────

async function ingestClimateEvidence(): Promise<DarmcPlace[]> {
  console.log('\n=== Ingesting Roman/Post-Roman Climate Evidence ===')

  const buffer = await downloadFile(
    2446027,
    'McCormick_et_al_2012_Geodatabase_Historical_Evidence_on_Roman_Post-Roman_Climate.xls',
  )

  if (!buffer) {
    console.log('  Failed to download Excel file')
    return []
  }

  const workbook = XLSX.read(buffer, { type: 'buffer' })
  console.log(`  Sheets: ${workbook.SheetNames.join(', ')}`)

  const places: DarmcPlace[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

    if (rows.length === 0) continue

    // Skip non-data sheets
    if (sheetName.toLowerCase().includes('read me') || sheetName.toLowerCase().includes('key')) {
      continue
    }

    console.log(`  Processing sheet "${sheetName}": ${rows.length} rows`)

    for (const row of rows) {
      // Columns: "Latitude 1", "Longtitude 1" (note the typo in the original data)
      const lat = parseFloat(String(row['Latitude 1'] || row['Latitude'] || row['lat'] || ''))
      const lng = parseFloat(
        String(row['Longtitude 1'] || row['Longitude 1'] || row['Longitude'] || row['lon'] || ''),
      )

      if (!isValidCoord(lat, lng)) continue

      // Year column is "When 1"
      const year = parseOptionalYear(row['When 1'] || row['Year'] || row['DATE'])

      // Filter to Roman period (100 BC - 500 AD)
      if (year !== null && (year < -100 || year > 500)) continue

      const where = String(row['Where'] || '').trim()
      const phenomena = String(row['Phenomena'] || '').trim()
      const what = String(row['What'] || '').trim()
      const evidence = String(row['EVIDENCE'] || '').trim()

      const displayName =
        where || phenomena || `Climate event at ${lat.toFixed(2)}, ${lng.toFixed(2)}`
      const yearStr =
        year !== null ? (year < 0 ? `${Math.abs(year)} BC` : `${year} AD`) : 'unknown date'
      const id = `darmc-climate-${toKebabCase(displayName)}-${year || 'unknown'}`

      const descParts: string[] = []
      if (what) descParts.push(what)
      if (phenomena && phenomena !== displayName) descParts.push(`Location: ${phenomena}`)
      if (evidence) descParts.push(`Source: ${evidence.substring(0, 100)}`)
      descParts.push(`(${yearStr})`)

      places.push({
        id,
        name: displayName,
        lat: Math.round(lat * 10000) / 10000,
        lng: Math.round(lng * 10000) / 10000,
        placeType: 'climate-event',
        startYear: year,
        endYear: year,
        description: descParts.join('. '),
        source: 'DARMC',
      })
    }

    if (places.length > 0) break
  }

  console.log(`  Extracted ${places.length} climate evidence locations`)
  return places
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== DARMC Data Ingestion ===')
  console.log('Fetching datasets from Harvard Dataverse...\n')

  // Run all ingestions
  const [roads, ports, climate] = await Promise.all([
    ingestRomanRoads(),
    ingestAncientPorts(),
    ingestClimateEvidence(),
  ])

  // ─── Write darmc-places.json ───────────────────────────────────────────────

  // Combine all point data (ports + climate evidence)
  const allPlaces = [...ports, ...climate]

  // Deduplicate by proximity (within ~0.5 degree)
  const deduped = deduplicatePlaces(allPlaces)

  console.log(`\n=== Output Summary ===`)
  console.log(`  Total places before dedup: ${allPlaces.length}`)
  console.log(`  Total places after dedup: ${deduped.length}`)

  const placesPath = join(DATA_DIR, 'darmc-places.json')
  await writeFile(placesPath, JSON.stringify(deduped, null, 2) + '\n')
  console.log(`  Written places to ${placesPath}`)
  console.log(`    File size: ${(JSON.stringify(deduped, null, 2).length / 1024).toFixed(1)} KB`)

  // Breakdown by type
  const typeCounts = new Map<string, number>()
  for (const p of deduped) {
    typeCounts.set(p.placeType, (typeCounts.get(p.placeType) || 0) + 1)
  }
  console.log(`    Types:`)
  for (const [type, count] of typeCounts) {
    console.log(`      ${type}: ${count}`)
  }

  // ─── Write darmc-roads.json ────────────────────────────────────────────────

  if (roads.length > 0) {
    const roadsPath = join(DATA_DIR, 'darmc-roads.json')
    const roadsJson = JSON.stringify(roads, null, 2)
    await writeFile(roadsPath, roadsJson + '\n')
    console.log(`\n  Written roads to ${roadsPath}`)
    console.log(`    ${roads.length} road segments`)
    console.log(`    File size: ${(roadsJson.length / 1024).toFixed(1)} KB`)

    // Stats on road coordinates
    const totalPoints = roads.reduce((sum, r) => sum + r.coordinates.length, 0)
    console.log(`    Total coordinate points: ${totalPoints}`)
  }

  console.log('\n=== DARMC ingestion complete ===')
}

function deduplicatePlaces(places: DarmcPlace[]): DarmcPlace[] {
  const seen = new Map<string, DarmcPlace>()
  for (const p of places) {
    // Use rounded coords as proximity key
    const key = `${p.placeType}-${Math.round(p.lat * 20)}-${Math.round(p.lng * 20)}-${p.name.toLowerCase()}`
    if (!seen.has(key)) {
      seen.set(key, p)
    }
  }
  return Array.from(seen.values())
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
