/**
 * Script to fetch and process Roman amphitheaters data.
 * Source: https://github.com/roman-amphitheaters/roman-amphitheaters
 *
 * Usage: npx tsx scripts/ingest-amphitheaters.ts
 */

import { writeFile, mkdir } from 'fs/promises'
import { fileURLToPath } from 'url'

const URLS = [
  'https://raw.githubusercontent.com/roman-amphitheaters/roman-amphitheaters/master/roman-amphitheaters.geojson',
  'https://raw.githubusercontent.com/roman-amphitheaters/roman-amphitheaters/main/roman-amphitheaters.geojson',
]

interface GeoJSONFeature {
  type: 'Feature'
  properties: Record<string, unknown>
  geometry: {
    type: string
    coordinates: number[]
  }
}

interface GeoJSONCollection {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
}

interface Amphitheater {
  id: string
  name: string
  lat: number
  lng: number
  capacity: number | null
  constructionYear: number | null
  dimensions: string | null
  city: string
  source: string
  pleiadesId: string | null
}

function truncateCoord(n: number): number {
  return Math.round(n * 10000) / 10000
}

/** Map chronogroup to an approximate construction year */
const CHRONOGROUP_YEARS: Record<string, number> = {
  republican: -70,
  caesarean: -50,
  augustan: -10,
  'julio-claudian': 30,
  neronian: 60,
  flavian: 75,
  'late-first-century': 90,
  'first-century': 50,
  hadrianic: 125,
  'second-century': 150,
  'late-second-century': 180,
  severan: 210,
  imperial: 100,
  'gallo-roman-amphitheater': 100,
  'arena-in-hippodrome': 200,
}

function extractPleiadesId(url: unknown): string | null {
  if (typeof url !== 'string') return null
  const match = url.match(/pleiades\.stoa\.org\/places\/(\d+)/)
  return match ? match[1] : null
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function convertFeature(feature: GeoJSONFeature): Amphitheater | null {
  const props = feature.properties
  const coords = feature.geometry?.coordinates
  if (!coords || coords.length < 2) return null

  const label = String(props.label || '')
  const title = String(props.title || '')
  const name = label || title
  if (!name) return null

  const id = slugify(name)

  // Coordinates are [lng, lat, elevation]
  const lng = truncateCoord(coords[0])
  const lat = truncateCoord(coords[1])

  // Capacity
  let capacity: number | null = null
  if (props.capacity && typeof props.capacity === 'object') {
    const cap = (props.capacity as Record<string, unknown>).quantity
    if (typeof cap === 'number') capacity = cap
  }

  // Construction year
  let constructionYear: number | null = null
  if (typeof props.created === 'number') {
    constructionYear = props.created
  } else if (typeof props.chronogroup === 'string') {
    constructionYear = CHRONOGROUP_YEARS[props.chronogroup] ?? null
  }

  // Dimensions from exteriormajor x exteriorminor
  let dimensions: string | null = null
  if (props.dimensions && typeof props.dimensions === 'object') {
    const dims = props.dimensions as Record<string, unknown>
    const major = dims.exteriormajor
    const minor = dims.exteriorminor
    if (typeof major === 'number' && typeof minor === 'number') {
      dimensions = `${major}x${minor}m`
    }
  }

  // City: use latintoponym or label
  const city = String(props.latintoponym || label || '')

  // Pleiades ID
  const pleiadesId = extractPleiadesId(props.pleiadesspecific) || extractPleiadesId(props.pleiades)

  return {
    id,
    name,
    lat,
    lng,
    capacity,
    constructionYear,
    dimensions,
    city,
    source: 'roman-amphitheaters',
    pleiadesId,
  }
}

async function fetchGeoJSON(): Promise<GeoJSONCollection> {
  for (const url of URLS) {
    console.log(`Fetching ${url}...`)
    try {
      const res = await fetch(url)
      if (res.ok) {
        console.log(`  OK (${res.status})`)
        return (await res.json()) as GeoJSONCollection
      }
      console.log(`  Failed: ${res.status}`)
    } catch (err) {
      console.log(`  Error: ${(err as Error).message}`)
    }
  }
  throw new Error('All fetch URLs failed')
}

async function main() {
  console.log('Ingesting Roman amphitheaters data...\n')

  const data = await fetchGeoJSON()
  console.log(`\nLoaded ${data.features.length} features from GeoJSON\n`)

  const amphitheaters: Amphitheater[] = []
  const seenIds = new Set<string>()

  for (const feature of data.features) {
    const amp = convertFeature(feature)
    if (!amp) continue

    // Deduplicate by id
    let uniqueId = amp.id
    if (seenIds.has(uniqueId)) {
      let counter = 2
      while (seenIds.has(`${amp.id}-${counter}`)) counter++
      uniqueId = `${amp.id}-${counter}`
      amp.id = uniqueId
    }
    seenIds.add(uniqueId)

    amphitheaters.push(amp)
  }

  // Sort by capacity (largest first), nulls at end
  amphitheaters.sort((a, b) => {
    if (a.capacity === null && b.capacity === null) return 0
    if (a.capacity === null) return 1
    if (b.capacity === null) return -1
    return b.capacity - a.capacity
  })

  const outDir = fileURLToPath(new URL('../src/data/amphitheaters', import.meta.url))
  await mkdir(outDir, { recursive: true })

  const outPath = fileURLToPath(
    new URL('../src/data/amphitheaters/amphitheaters.json', import.meta.url),
  )
  const json = JSON.stringify(amphitheaters, null, 2)
  await writeFile(outPath, json + '\n')

  const withCapacity = amphitheaters.filter((a) => a.capacity !== null)
  const withYear = amphitheaters.filter((a) => a.constructionYear !== null)
  const withDims = amphitheaters.filter((a) => a.dimensions !== null)

  console.log(`Results:`)
  console.log(`  Total amphitheaters: ${amphitheaters.length}`)
  console.log(`  With capacity: ${withCapacity.length}`)
  console.log(`  With construction year: ${withYear.length}`)
  console.log(`  With dimensions: ${withDims.length}`)
  console.log(`  Output: ${outPath} (${(json.length / 1024).toFixed(0)} KB)`)
  console.log(`\nTop 5 by capacity:`)
  for (const a of amphitheaters.slice(0, 5)) {
    console.log(
      `  ${a.name}: ${a.capacity?.toLocaleString()} (${a.city}, ${a.constructionYear ?? '?'})`,
    )
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
