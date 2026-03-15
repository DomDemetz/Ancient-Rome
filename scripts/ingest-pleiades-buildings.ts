/**
 * Script to fetch and process Roman-era buildings from the Pleiades dataset.
 * Source: https://pleiades.stoa.org/
 *
 * Downloads the full Pleiades JSON dump, streams it to disk, then uses
 * a streaming JSON parser to extract building features.
 *
 * Usage: npx tsx scripts/ingest-pleiades-buildings.ts
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GEOJSON_URL = 'https://atlantides.org/downloads/pleiades/json/pleiades-places-latest.json.gz'

const FEATURE_TYPE_KEYWORDS = [
  'temple',
  'church',
  'bath',
  'theatre',
  'theater',
  'amphitheatre',
  'amphitheater',
  'basilica',
  'forum',
  'circus',
  'hippodrome',
  'arch',
  'aqueduct',
  'bridge',
  'palace',
  'library',
  'stadium',
  'odeum',
  'nymphaeum',
  'stoa',
  'agora',
  'monument',
  'mausoleum',
  'villa',
  'sanctuary',
  'thermae',
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
}

const ROMAN_PERIODS = [
  'roman',
  'late-antique',
  'hellenistic-republican',
  'roman-early-empire',
  'roman-late-empire',
  'roman-republic',
]

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

/**
 * Match placeTypes against building keywords.
 * Pleiades uses variants like "temple-2", "church-2", "bath" etc.
 */
function matchesFeatureType(placeTypes: string[]): string | null {
  for (const pt of placeTypes) {
    const lower = pt.toLowerCase()
    for (const keyword of FEATURE_TYPE_KEYWORDS) {
      if (lower.includes(keyword)) {
        return BUILDING_TYPE_MAP[keyword] || keyword
      }
    }
  }
  return null
}

/**
 * Check if any attestation across all locations has a Roman-era time period.
 */
function hasRomanPeriod(place: PleiadesPlace): boolean {
  if (!place.locations || place.locations.length === 0) return false
  for (const loc of place.locations) {
    if (!loc.attestations) continue
    for (const att of loc.attestations) {
      const key = (att.timePeriod || '').toLowerCase()
      if (ROMAN_PERIODS.some((rp) => key.includes(rp))) {
        return true
      }
    }
  }
  return false
}

/**
 * Estimate construction year from the earliest Roman-era attestation.
 */
function estimateConstructionYear(place: PleiadesPlace): number {
  let earliest = Infinity
  if (place.locations) {
    for (const loc of place.locations) {
      if (!loc.attestations) continue
      for (const att of loc.attestations) {
        const key = (att.timePeriod || '').toLowerCase()
        for (const [period, year] of Object.entries(PERIOD_YEARS)) {
          if (key.includes(period) && year < earliest) {
            earliest = year
          }
        }
      }
    }
  }
  return earliest === Infinity ? 50 : earliest
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

function processPlace(place: PleiadesPlace): Building | null {
  const placeTypes = place.placeTypes || []
  const typeArray = Array.isArray(placeTypes) ? placeTypes : [placeTypes]
  const buildingType = matchesFeatureType(typeArray.map((t: unknown) => String(t)))
  if (!buildingType) return null

  const coords = getCoordinates(place)
  if (!coords) return null

  if (!hasRomanPeriod(place)) return null

  const constructionYear = estimateConstructionYear(place)
  const rawId = place.id ? String(place.id) : slugify(place.title || 'unknown')

  return {
    id: rawId,
    name: place.title || 'Unknown',
    lat: coords.lat,
    lng: coords.lng,
    buildingType,
    constructionYear,
    builder: null,
    description: place.description || '',
    source: 'Pleiades',
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

  const tmpFile = join(tmpdir(), `pleiades-${Date.now()}.json`)
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

/**
 * Stream-parse the JSON file character by character, properly handling
 * strings (including escaped characters) so that braces inside strings
 * don't confuse the bracket matching.
 */
async function streamParsePlaces(filePath: string): Promise<Building[]> {
  console.log('Stream-parsing places from JSON file...')

  return new Promise((resolve, reject) => {
    const buildings: Building[] = []
    const seenIds = new Set<string>()
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
          // Accumulate to find "@graph"
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

        // Inside @graph - track strings properly
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
                `  Processed ${placesProcessed} places, found ${buildings.length} buildings...`,
              )
            }

            try {
              const place = JSON.parse(objStr) as PleiadesPlace
              const building = processPlace(place)
              if (building) {
                let id = building.id
                if (seenIds.has(id)) {
                  let counter = 2
                  while (seenIds.has(`${building.id}-${counter}`)) counter++
                  id = `${building.id}-${counter}`
                  building.id = id
                }
                seenIds.add(id)
                buildings.push(building)
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
          resolve(buildings)
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
      resolve(buildings)
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
  console.log('Ingesting Roman-era buildings from Pleiades...\n')

  let tmpFile: string
  try {
    tmpFile = await downloadToTempFile(GEOJSON_URL)
  } catch (err) {
    console.error(`Download failed: ${(err as Error).message}`)
    process.exit(1)
  }

  try {
    const buildings = await streamParsePlaces(tmpFile)

    // Sort by building type then name
    buildings.sort((a, b) => {
      if (a.buildingType !== b.buildingType) return a.buildingType.localeCompare(b.buildingType)
      return a.name.localeCompare(b.name)
    })

    // Write output
    const outDir = fileURLToPath(new URL('../src/data/buildings', import.meta.url))
    await mkdirAsync(outDir, { recursive: true })

    const outPath = fileURLToPath(new URL('../src/data/buildings/buildings.json', import.meta.url))
    const json = JSON.stringify(buildings, null, 2)
    await writeFileAsync(outPath, json + '\n')

    // Stats
    const typeCounts: Record<string, number> = {}
    for (const b of buildings) {
      typeCounts[b.buildingType] = (typeCounts[b.buildingType] || 0) + 1
    }

    console.log('\nResults:')
    console.log(`  Total buildings: ${buildings.length}`)
    console.log(`  Output: ${outPath} (${(json.length / 1024).toFixed(0)} KB)`)
    console.log('\nBy building type:')
    for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${type}: ${count}`)
    }

    console.log('\nSample entries:')
    for (const b of buildings.slice(0, 5)) {
      console.log(`  ${b.name} (${b.buildingType}, ${b.constructionYear}) [${b.lat}, ${b.lng}]`)
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
