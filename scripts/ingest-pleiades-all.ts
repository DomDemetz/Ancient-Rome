/**
 * Comprehensive Pleiades ingestion script.
 * Downloads the full Pleiades JSON dump and categorizes ALL places with
 * coordinates into separate data files by type.
 *
 * Output files:
 *   - src/data/buildings/buildings.json         (temples, theaters, baths, etc.)
 *   - src/data/mines/mines-pleiades.json        (mines, quarries)
 *   - src/data/religion/religion-pleiades.json   (temples, sanctuaries, churches, etc.)
 *   - src/data/pleiades-all.json                (everything else)
 *
 * Usage: npx tsx scripts/ingest-pleiades-all.ts
 */

import { writeFile as writeFileAsync, mkdir as mkdirAsync, unlink } from 'fs/promises'
import { createReadStream, createWriteStream } from 'fs'
import { fileURLToPath } from 'url'
import { createGunzip } from 'zlib'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { tmpdir } from 'os'
import { join } from 'path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PleiadesAttestation {
  timePeriod: string
  [key: string]: unknown
}

interface PleiadesLocation {
  attestations?: PleiadesAttestation[]
  featureType?: string[]
  geometry?: {
    type: string
    coordinates: number[]
  }
  [key: string]: unknown
}

interface PleiadesPlace {
  id: string | number
  title: string
  description: string
  reprPoint: [number, number] | null
  placeTypes: string[]
  locations?: PleiadesLocation[]
  features?: Array<{
    geometry?: {
      type: string
      coordinates: number[]
    }
  }>
  [key: string]: unknown
}

interface Building {
  id: string
  name: string
  lat: number
  lng: number
  buildingType: string
  constructionYear: number
  builder: null
  description: string
  source: 'Pleiades'
}

interface MineSite {
  id: string
  name: string
  lat: number
  lng: number
  resourceType: 'unknown'
  siteType: string
  startYear: number
  endYear: number
  description: string
  source: 'Pleiades'
}

interface ReligionSite {
  id: string
  name: string
  lat: number
  lng: number
  religion: 'roman'
  siteType: string
  deity: null
  startYear: number
  endYear: number
  description: string
  source: 'Pleiades'
}

interface GenericPlace {
  id: string
  name: string
  lat: number
  lng: number
  placeType: string
  startYear: number
  endYear: number
  description: string
  source: 'Pleiades'
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GEOJSON_URL = 'https://atlantides.org/downloads/pleiades/json/pleiades-places-latest.json.gz'

// Building keywords
const BUILDING_KEYWORDS = [
  'temple',
  'theatre',
  'theater',
  'bath',
  'thermae',
  'forum',
  'agora',
  'circus',
  'hippodrome',
  'stadium',
  'basilica',
  'church',
  'arch',
  'monument',
  'mausoleum',
  'palace',
  'villa',
  'library',
  'bridge',
  'aqueduct',
  'nymphaeum',
  'stoa',
  'odeum',
  'amphitheatre',
  'amphitheater',
  'column',
]

// Mine keywords
const MINE_KEYWORDS = ['mine', 'quarry']

// Religion keywords
const RELIGION_KEYWORDS = [
  'temple',
  'sanctuary',
  'shrine',
  'church',
  'synagogue',
  'cathedral',
  'chapel',
  'monastery',
]

const BUILDING_TYPE_MAP: Record<string, string> = {
  temple: 'temple',
  sanctuary: 'temple',
  church: 'basilica',
  basilica: 'basilica',
  bath: 'bath',
  thermae: 'bath',
  theatre: 'theater',
  theater: 'theater',
  odeum: 'theater',
  amphitheatre: 'amphitheater',
  amphitheater: 'amphitheater',
  forum: 'forum',
  agora: 'forum',
  circus: 'circus',
  hippodrome: 'circus',
  stadium: 'circus',
  arch: 'arch',
  monument: 'arch',
  mausoleum: 'arch',
  palace: 'palace',
  villa: 'palace',
  library: 'library',
  bridge: 'bridge',
  aqueduct: 'aqueduct',
  nymphaeum: 'temple',
  stoa: 'temple',
  column: 'column',
}

const PERIOD_YEARS: Record<string, number> = {
  archaic: -600,
  classical: -450,
  'hellenistic-republican': -200,
  'roman-republic': -200,
  roman: 50,
  'roman-early-empire': 50,
  'roman-late-empire': 250,
  'late-antique': 400,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateCoord(n: number): number {
  return Math.round(n * 10000) / 10000
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function getCoordinates(place: PleiadesPlace): { lat: number; lng: number } | null {
  // Prefer reprPoint [lng, lat]
  if (
    place.reprPoint &&
    Array.isArray(place.reprPoint) &&
    place.reprPoint.length >= 2 &&
    typeof place.reprPoint[0] === 'number' &&
    typeof place.reprPoint[1] === 'number'
  ) {
    return {
      lat: truncateCoord(place.reprPoint[1]),
      lng: truncateCoord(place.reprPoint[0]),
    }
  }

  // Fallback to first feature geometry
  if (place.features && place.features.length > 0) {
    for (const f of place.features) {
      if (f.geometry && f.geometry.type === 'Point' && f.geometry.coordinates) {
        const c = f.geometry.coordinates
        if (c.length >= 2 && typeof c[0] === 'number' && typeof c[1] === 'number') {
          return { lat: truncateCoord(c[1]), lng: truncateCoord(c[0]) }
        }
      }
    }
  }

  return null
}

/**
 * Match placeTypes against a set of keywords.
 * Returns the first matching keyword, or null.
 */
function matchKeyword(placeTypes: string[], keywords: string[]): string | null {
  for (const pt of placeTypes) {
    const lower = pt.toLowerCase()
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        return keyword
      }
    }
  }
  return null
}

/**
 * Get startYear and endYear from attestation periods.
 * Uses earliest period for startYear, latest for endYear.
 */
function getTimePeriods(place: PleiadesPlace): { startYear: number; endYear: number } {
  let earliest = Infinity
  let latest = -Infinity

  if (place.locations) {
    for (const loc of place.locations) {
      if (!loc.attestations) continue
      for (const att of loc.attestations) {
        const key = (att.timePeriod || '').toLowerCase()
        for (const [period, year] of Object.entries(PERIOD_YEARS)) {
          if (key.includes(period)) {
            if (year < earliest) earliest = year
            if (year > latest) latest = year
          }
        }
      }
    }
  }

  return {
    startYear: earliest === Infinity ? 50 : earliest,
    endYear: latest === -Infinity ? 250 : latest,
  }
}

// ---------------------------------------------------------------------------
// Categorization
// ---------------------------------------------------------------------------

interface CategorizedResults {
  buildings: Building[]
  mines: MineSite[]
  religion: ReligionSite[]
  generic: GenericPlace[]
}

function categorizePlace(place: PleiadesPlace, results: CategorizedResults): void {
  const placeTypes = place.placeTypes || []
  const typeArray = (Array.isArray(placeTypes) ? placeTypes : [placeTypes]).map((t: unknown) =>
    String(t),
  )

  const coords = getCoordinates(place)
  if (!coords) return

  const rawId = place.id ? String(place.id) : slugify(place.title || 'unknown')
  const name = place.title || 'Unknown'
  const description = place.description || ''
  const { startYear, endYear } = getTimePeriods(place)

  let categorized = false

  // Check buildings
  const buildingKeyword = matchKeyword(typeArray, BUILDING_KEYWORDS)
  if (buildingKeyword) {
    const buildingType = BUILDING_TYPE_MAP[buildingKeyword] || buildingKeyword
    results.buildings.push({
      id: rawId,
      name,
      lat: coords.lat,
      lng: coords.lng,
      buildingType,
      constructionYear: startYear,
      builder: null,
      description,
      source: 'Pleiades',
    })
    categorized = true
  }

  // Check mines
  const mineKeyword = matchKeyword(typeArray, MINE_KEYWORDS)
  if (mineKeyword) {
    results.mines.push({
      id: rawId,
      name,
      lat: coords.lat,
      lng: coords.lng,
      resourceType: 'unknown',
      siteType: mineKeyword,
      startYear,
      endYear,
      description,
      source: 'Pleiades',
    })
    categorized = true
  }

  // Check religion (NOTE: temples appear in BOTH buildings and religion)
  const religionKeyword = matchKeyword(typeArray, RELIGION_KEYWORDS)
  if (religionKeyword) {
    results.religion.push({
      id: rawId,
      name,
      lat: coords.lat,
      lng: coords.lng,
      religion: 'roman',
      siteType: religionKeyword,
      deity: null,
      startYear,
      endYear,
      description,
      source: 'Pleiades',
    })
    categorized = true
  }

  // Everything else goes to generic
  if (!categorized) {
    results.generic.push({
      id: rawId,
      name,
      lat: coords.lat,
      lng: coords.lng,
      placeType: typeArray.join(', ') || 'unknown',
      startYear,
      endYear,
      description,
      source: 'Pleiades',
    })
  }
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

  const tmpFile = join(tmpdir(), `pleiades-all-${Date.now()}.json`)
  console.log(`Streaming to temp file: ${tmpFile}`)

  const nodeStream = Readable.fromWeb(res.body as import('stream/web').ReadableStream)
  const gunzip = createGunzip()
  const outStream = createWriteStream(tmpFile)

  await pipeline(nodeStream, gunzip, outStream)

  console.log('Download and decompression complete.')
  return tmpFile
}

// ---------------------------------------------------------------------------
// Streaming JSON parser
// ---------------------------------------------------------------------------

async function streamParsePlaces(filePath: string): Promise<CategorizedResults> {
  console.log('Stream-parsing places from JSON file...')

  return new Promise((resolve, reject) => {
    const results: CategorizedResults = {
      buildings: [],
      mines: [],
      religion: [],
      generic: [],
    }

    // Dedup sets per category
    const seenBuildings = new Set<string>()
    const seenMines = new Set<string>()
    const seenReligion = new Set<string>()
    const seenGeneric = new Set<string>()

    let buffer = ''
    let inGraph = false
    let depth = 0
    let objectStart = -1
    let placesProcessed = 0
    let inString = false
    let escape = false
    let searchBuffer = ''

    const stream = createReadStream(filePath, {
      encoding: 'utf-8',
      highWaterMark: 1024 * 1024,
    })

    stream.on('data', (chunk: string) => {
      for (let i = 0; i < chunk.length; i++) {
        const ch = chunk[i]

        if (!inGraph) {
          searchBuffer += ch
          if (searchBuffer.length > 20) {
            searchBuffer = searchBuffer.slice(-20)
          }
          if (searchBuffer.includes('"@graph"')) {
            inGraph = true
            searchBuffer = ''
            buffer = ''
            depth = 0
            objectStart = -1
            inString = false
            escape = false
          }
          continue
        }

        buffer += ch

        if (escape) {
          escape = false
          continue
        }

        if (ch === '\\' && inString) {
          escape = true
          continue
        }

        if (ch === '"') {
          inString = !inString
          continue
        }

        if (inString) continue

        if (ch === '{') {
          if (depth === 0) {
            objectStart = buffer.length - 1
          }
          depth++
        } else if (ch === '}') {
          depth--
          if (depth === 0 && objectStart >= 0) {
            const objStr = buffer.slice(objectStart)
            placesProcessed++

            if (placesProcessed % 10000 === 0) {
              console.log(
                `  Processed ${placesProcessed} places — buildings: ${results.buildings.length}, mines: ${results.mines.length}, religion: ${results.religion.length}, generic: ${results.generic.length}`,
              )
            }

            try {
              const place = JSON.parse(objStr) as PleiadesPlace
              const prevB = results.buildings.length
              const prevM = results.mines.length
              const prevR = results.religion.length
              const prevG = results.generic.length

              categorizePlace(place, results)

              // Dedup buildings
              for (let j = prevB; j < results.buildings.length; j++) {
                const b = results.buildings[j]
                if (seenBuildings.has(b.id)) {
                  let counter = 2
                  while (seenBuildings.has(`${b.id}-${counter}`)) counter++
                  b.id = `${b.id}-${counter}`
                }
                seenBuildings.add(b.id)
              }
              // Dedup mines
              for (let j = prevM; j < results.mines.length; j++) {
                const m = results.mines[j]
                if (seenMines.has(m.id)) {
                  let counter = 2
                  while (seenMines.has(`${m.id}-${counter}`)) counter++
                  m.id = `${m.id}-${counter}`
                }
                seenMines.add(m.id)
              }
              // Dedup religion
              for (let j = prevR; j < results.religion.length; j++) {
                const r = results.religion[j]
                if (seenReligion.has(r.id)) {
                  let counter = 2
                  while (seenReligion.has(`${r.id}-${counter}`)) counter++
                  r.id = `${r.id}-${counter}`
                }
                seenReligion.add(r.id)
              }
              // Dedup generic
              for (let j = prevG; j < results.generic.length; j++) {
                const g = results.generic[j]
                if (seenGeneric.has(g.id)) {
                  let counter = 2
                  while (seenGeneric.has(`${g.id}-${counter}`)) counter++
                  g.id = `${g.id}-${counter}`
                }
                seenGeneric.add(g.id)
              }
            } catch {
              // Skip malformed objects
            }

            buffer = ''
            objectStart = -1
          }
        } else if (ch === ']' && depth === 0) {
          console.log(`  Finished processing ${placesProcessed} total places.`)
          stream.destroy()
          resolve(results)
          return
        }

        // Keep buffer small when between objects
        if (depth === 0 && objectStart === -1 && buffer.length > 100) {
          buffer = ''
        }
      }
    })

    stream.on('end', () => {
      console.log(`  Stream ended after ${placesProcessed} places.`)
      resolve(results)
    })

    stream.on('error', (err) => {
      reject(err)
    })
  })
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Comprehensive Pleiades ingestion — extracting ALL places\n')

  let tmpFile: string
  try {
    tmpFile = await downloadToTempFile(GEOJSON_URL)
  } catch (err) {
    console.error(`Download failed: ${(err as Error).message}`)
    process.exit(1)
  }

  try {
    const results = await streamParsePlaces(tmpFile)

    // Sort each output
    results.buildings.sort((a, b) => {
      if (a.buildingType !== b.buildingType) return a.buildingType.localeCompare(b.buildingType)
      return a.name.localeCompare(b.name)
    })
    results.mines.sort((a, b) => a.name.localeCompare(b.name))
    results.religion.sort((a, b) => a.name.localeCompare(b.name))
    results.generic.sort((a, b) => a.name.localeCompare(b.name))

    // Resolve output paths
    const baseDir = fileURLToPath(new URL('../src/data', import.meta.url))

    const outputs: Array<{ label: string; path: string; data: unknown[]; dir: string }> = [
      {
        label: 'buildings',
        path: join(baseDir, 'buildings', 'buildings.json'),
        data: results.buildings,
        dir: join(baseDir, 'buildings'),
      },
      {
        label: 'mines',
        path: join(baseDir, 'mines', 'mines-pleiades.json'),
        data: results.mines,
        dir: join(baseDir, 'mines'),
      },
      {
        label: 'religion',
        path: join(baseDir, 'religion', 'religion-pleiades.json'),
        data: results.religion,
        dir: join(baseDir, 'religion'),
      },
      {
        label: 'pleiades-all',
        path: join(baseDir, 'pleiades-all.json'),
        data: results.generic,
        dir: baseDir,
      },
    ]

    console.log('\n--- Output Summary ---\n')

    for (const out of outputs) {
      await mkdirAsync(out.dir, { recursive: true })
      const json = JSON.stringify(out.data, null, 2)
      await writeFileAsync(out.path, json + '\n')
      console.log(
        `${out.label}: ${out.data.length} entries → ${out.path} (${(json.length / 1024).toFixed(0)} KB)`,
      )
    }

    // Detailed stats
    console.log('\n--- Building Types ---')
    const buildingCounts: Record<string, number> = {}
    for (const b of results.buildings) {
      buildingCounts[b.buildingType] = (buildingCounts[b.buildingType] || 0) + 1
    }
    for (const [type, count] of Object.entries(buildingCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${type}: ${count}`)
    }

    console.log('\n--- Mine Types ---')
    const mineCounts: Record<string, number> = {}
    for (const m of results.mines) {
      mineCounts[m.siteType] = (mineCounts[m.siteType] || 0) + 1
    }
    for (const [type, count] of Object.entries(mineCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${type}: ${count}`)
    }

    console.log('\n--- Religion Types ---')
    const religionCounts: Record<string, number> = {}
    for (const r of results.religion) {
      religionCounts[r.siteType] = (religionCounts[r.siteType] || 0) + 1
    }
    for (const [type, count] of Object.entries(religionCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${type}: ${count}`)
    }

    console.log('\n--- Sample Generic Places ---')
    for (const g of results.generic.slice(0, 10)) {
      console.log(`  ${g.name} [${g.placeType}] (${g.startYear} to ${g.endYear})`)
    }

    const total =
      results.buildings.length +
      results.mines.length +
      results.religion.length +
      results.generic.length
    console.log(`\nTotal places with coordinates: ${total}`)
    console.log('Done.')
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
