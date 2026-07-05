/**
 * Script to fetch and process Roman-era archaeological sites from the Vici.org database.
 * Source: https://vici.org/
 *
 * Vici.org's GeoJSON API requires authentication, so this script downloads the
 * public SQL database dump from the official GitHub repository and parses the
 * INSERT statements to extract site data.
 *
 * Usage: npx tsx scripts/ingest-vici.ts
 */

import { writeFile as writeFileAsync, mkdir as mkdirAsync, unlink } from 'fs/promises'
import { createReadStream } from 'fs'
import { fileURLToPath } from 'url'
import { createGunzip } from 'zlib'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { tmpdir } from 'os'
import { join, dirname } from 'path'
import { createInterface } from 'readline'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ViciSite {
  id: string
  name: string
  lat: number
  lng: number
  siteType: string
  description: string
  startYear: number
  endYear: number
  source: 'vici.org'
}

interface PointRow {
  pnt_id: number
  pnt_name: string
  pnt_kind: number
  pnt_visible: number
  pnt_lat: number
  pnt_lng: number
  pnt_dflt_short: string
  pnt_hide: number
}

interface MetadataRow {
  pmeta_pnt_id: number
  pmeta_startyr: number | null
  pmeta_endyr: number | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VICI_SQL_URL = 'https://raw.githubusercontent.com/renevoorburg/vici.org/main/db/vici.sql.gz'

/**
 * Vici pnt_kind IDs mapped to simplified site type categories.
 * Source: classViciCommon.php in the vici.org repository.
 */
const VICI_KIND_MAP: Record<number, string> = {
  1: 'aqueduct', // aquaduct
  2: 'bath', // baths
  3: 'settlement', // city
  4: 'fort', // fort
  5: 'cemetery', // graves
  6: 'mine', // industry
  7: 'settlement', // mansio (road station)
  8: 'other', // museum (modern, skip or mark as other)
  9: 'settlement', // vicus
  10: 'other', // shipwreck
  11: 'temple', // temple
  12: 'theater', // theater
  13: 'villa', // villa
  14: 'settlement', // rural
  15: 'fort', // watchtower
  16: 'temple', // altar
  17: 'other', // object
  18: 'other', // observation
  19: 'other', // memorial
  20: 'road', // milestone
  21: 'other', // building
  22: 'bridge', // bridge
  23: 'road', // road
  24: 'other', // event
  25: 'fort', // camp
}

// Skip museum entries (kind=8) as they are modern institutions, not ancient sites
const SKIP_KINDS = new Set([8])

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateCoord(n: number): number {
  return Math.round(n * 10000) / 10000
}

/**
 * Parse a MySQL VALUES tuple, handling escaped quotes and NULL values.
 * Returns an array of string|null values.
 */
function parseSqlValues(valuesStr: string): (string | null)[] {
  const result: (string | null)[] = []
  let i = 0
  const len = valuesStr.length

  while (i < len) {
    // Skip whitespace/commas
    while (i < len && (valuesStr[i] === ',' || valuesStr[i] === ' ')) i++
    if (i >= len) break

    if (valuesStr[i] === "'") {
      // String value - read until unescaped closing quote
      i++ // skip opening quote
      let value = ''
      while (i < len) {
        if (valuesStr[i] === '\\' && i + 1 < len) {
          // Escaped character
          value += valuesStr[i + 1]
          i += 2
        } else if (valuesStr[i] === "'") {
          i++ // skip closing quote
          break
        } else {
          value += valuesStr[i]
          i++
        }
      }
      result.push(value)
    } else if (valuesStr.slice(i, i + 4) === 'NULL') {
      result.push(null)
      i += 4
    } else {
      // Numeric value
      let value = ''
      while (i < len && valuesStr[i] !== ',' && valuesStr[i] !== ')') {
        value += valuesStr[i]
        i++
      }
      result.push(value.trim())
    }
  }

  return result
}

/**
 * Extract all tuples from an INSERT statement.
 * Format: INSERT INTO `table` VALUES (v1,v2,...),(v1,v2,...);
 */
function extractTuples(line: string): (string | null)[][] {
  const tuples: (string | null)[][] = []

  // Find the VALUES keyword
  const valuesIdx = line.indexOf('VALUES ')
  if (valuesIdx === -1) return tuples

  const rest = line.slice(valuesIdx + 7)

  // Split by ),( but need to handle strings containing these chars
  let i = 0
  while (i < rest.length) {
    if (rest[i] === '(') {
      // Find matching closing paren
      i++
      let depth = 1
      let inStr = false
      let escaped = false
      const start = i
      while (i < rest.length && depth > 0) {
        if (escaped) {
          escaped = false
          i++
          continue
        }
        if (rest[i] === '\\' && inStr) {
          escaped = true
          i++
          continue
        }
        if (rest[i] === "'") {
          inStr = !inStr
        } else if (!inStr) {
          if (rest[i] === '(') depth++
          else if (rest[i] === ')') depth--
        }
        if (depth > 0) i++
      }
      const tupleStr = rest.slice(start, i)
      tuples.push(parseSqlValues(tupleStr))
      i++ // skip closing paren
    } else {
      i++
    }
  }

  return tuples
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

async function downloadToTempFile(url: string): Promise<string> {
  console.log(`Downloading ${url} ...`)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`)
  }
  if (!res.body) {
    throw new Error('No response body')
  }

  const tmpFile = join(tmpdir(), `vici-${Date.now()}.sql`)
  console.log(`Streaming and decompressing to: ${tmpFile}`)

  const { createWriteStream } = await import('fs')
  const nodeStream = Readable.fromWeb(res.body as import('stream/web').ReadableStream)
  const gunzip = createGunzip()
  const outStream = createWriteStream(tmpFile)

  await pipeline(nodeStream, gunzip, outStream)

  console.log('Download and decompression complete.')
  return tmpFile
}

// ---------------------------------------------------------------------------
// SQL Parsing
// ---------------------------------------------------------------------------

async function parsePointsFromSql(filePath: string): Promise<Map<number, PointRow>> {
  console.log('Parsing points table from SQL dump...')
  const points = new Map<number, PointRow>()

  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  })

  let inPointsSection = false

  for await (const line of rl) {
    if (line.includes('INSERT INTO `points`')) {
      inPointsSection = true
      const tuples = extractTuples(line)
      for (const t of tuples) {
        if (t.length < 9) continue
        const pnt_id = parseInt(t[0] || '0', 10)
        const pnt_kind = parseInt(t[2] || '0', 10)
        const pnt_visible = parseInt(t[3] || '0', 10)
        const pnt_lat = parseFloat(t[4] || '0')
        const pnt_lng = parseFloat(t[5] || '0')
        const pnt_hide = parseInt(t[8] || '0', 10)

        if (isNaN(pnt_lat) || isNaN(pnt_lng)) continue
        if (pnt_lat === 0 && pnt_lng === 0) continue
        if (Math.abs(pnt_lat) > 90 || Math.abs(pnt_lng) > 180) continue // corrupt source coords

        points.set(pnt_id, {
          pnt_id,
          pnt_name: t[1] || '',
          pnt_kind,
          pnt_visible,
          pnt_lat,
          pnt_lng,
          pnt_dflt_short: t[6] || '',
          pnt_hide,
        })
      }
    } else if (inPointsSection && line.startsWith('UNLOCK TABLES')) {
      inPointsSection = false
    }
  }

  console.log(`  Found ${points.size} point records.`)
  return points
}

async function parseMetadataFromSql(filePath: string): Promise<Map<number, MetadataRow>> {
  console.log('Parsing pmetadata table from SQL dump...')
  const metadata = new Map<number, MetadataRow>()

  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  })

  let inMetaSection = false

  for await (const line of rl) {
    if (line.includes('INSERT INTO `pmetadata`')) {
      inMetaSection = true
      const tuples = extractTuples(line)
      for (const t of tuples) {
        if (t.length < 17) continue
        const pmeta_pnt_id = parseInt(t[1] || '0', 10)
        const startYrRaw = t[15]
        const endYrRaw = t[16]

        const pmeta_startyr = startYrRaw !== null ? parseInt(startYrRaw, 10) : null
        const pmeta_endyr = endYrRaw !== null ? parseInt(endYrRaw, 10) : null

        metadata.set(pmeta_pnt_id, {
          pmeta_pnt_id,
          pmeta_startyr: pmeta_startyr !== null && !isNaN(pmeta_startyr) ? pmeta_startyr : null,
          pmeta_endyr: pmeta_endyr !== null && !isNaN(pmeta_endyr) ? pmeta_endyr : null,
        })
      }
    } else if (inMetaSection && line.startsWith('UNLOCK TABLES')) {
      inMetaSection = false
    }
  }

  console.log(`  Found ${metadata.size} metadata records.`)
  return metadata
}

// ---------------------------------------------------------------------------
// Processing
// ---------------------------------------------------------------------------

function buildSites(points: Map<number, PointRow>, metadata: Map<number, MetadataRow>): ViciSite[] {
  console.log('Building site records...')
  const sites: ViciSite[] = []

  for (const [id, pt] of points) {
    // Skip hidden points
    if (pt.pnt_hide === 1) continue

    // Skip museum/modern entries
    if (SKIP_KINDS.has(pt.pnt_kind)) continue

    // Map the kind to a simplified type
    const siteType = VICI_KIND_MAP[pt.pnt_kind] || 'other'

    // Get metadata (dates)
    const meta = metadata.get(id)
    const startYear = meta?.pmeta_startyr ?? 0
    const endYear = meta?.pmeta_endyr ?? 0

    sites.push({
      id: `vici-${pt.pnt_id}`,
      name: pt.pnt_name,
      lat: truncateCoord(pt.pnt_lat),
      lng: truncateCoord(pt.pnt_lng),
      siteType,
      description: pt.pnt_dflt_short,
      startYear,
      endYear,
      source: 'vici.org',
    })
  }

  return sites
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Ingesting Roman-era archaeological sites from Vici.org...\n')

  let tmpFile: string
  try {
    tmpFile = await downloadToTempFile(VICI_SQL_URL)
  } catch (err) {
    console.error(`Download failed: ${(err as Error).message}`)
    console.log('\nVici.org SQL dump could not be downloaded. Writing empty array.')
    const outPath = fileURLToPath(new URL('../src/data/vici-sites.json', import.meta.url))
    await writeFileAsync(outPath, '[]\n')
    process.exit(1)
  }

  try {
    // Parse both tables from the SQL dump
    const points = await parsePointsFromSql(tmpFile)
    const metadata = await parseMetadataFromSql(tmpFile)

    // Build site records
    const sites = buildSites(points, metadata)

    // Sort by site type then name
    sites.sort((a, b) => {
      if (a.siteType !== b.siteType) return a.siteType.localeCompare(b.siteType)
      return a.name.localeCompare(b.name)
    })

    // Write output
    const outPath = fileURLToPath(new URL('../src/data/vici-sites.json', import.meta.url))
    const outDir = dirname(outPath)
    await mkdirAsync(outDir, { recursive: true })

    const json = JSON.stringify(sites, null, 2)
    await writeFileAsync(outPath, json + '\n')

    // Stats
    const typeCounts: Record<string, number> = {}
    for (const s of sites) {
      typeCounts[s.siteType] = (typeCounts[s.siteType] || 0) + 1
    }

    const withDates = sites.filter((s) => s.startYear !== 0 || s.endYear !== 0).length

    console.log('\nResults:')
    console.log(`  Total sites: ${sites.length}`)
    console.log(`  Sites with date info: ${withDates}`)
    console.log(`  Output: ${outPath} (${(json.length / 1024).toFixed(0)} KB)`)
    console.log('\nBy site type:')
    for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${type}: ${count}`)
    }

    console.log('\nSample entries:')
    for (const s of sites.slice(0, 5)) {
      console.log(
        `  ${s.name} (${s.siteType}, ${s.startYear || '?'}–${s.endYear || '?'}) [${s.lat}, ${s.lng}]`,
      )
    }

    console.log('\nDone.')
  } finally {
    try {
      await unlink(tmpFile)
      console.log('Cleaned up temp file.')
    } catch {
      // ignore
    }
  }
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
