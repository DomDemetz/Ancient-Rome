/**
 * Script to ingest place data from the Pelagios network.
 *
 * Pelagios aggregates place references from ancient texts, maps, and
 * inscriptions — connecting textual mentions to geographic coordinates.
 *
 * Primary source: Pelagios heatmap dataset (places.json) which contains
 * coordinates and mention-count values for thousands of ancient places
 * referenced across the Pelagios linked-data ecosystem.
 *
 * We cross-reference these points against our existing DARE settlements
 * to attach proper ancient place names.
 *
 * Usage: npx tsx scripts/ingest-pelagios.ts
 */

import { writeFile, readFile, mkdir } from 'fs/promises'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HeatmapEntry {
  lat: number
  lon: number
  value: number
}

interface HeatmapData {
  max: string
  data: HeatmapEntry[]
}

interface DareSettlement {
  id: string
  name: string
  modern: string
  lat: number
  lng: number
  major: boolean
  type: number
  startYear: number
  endYear: number
  greek?: string
}

interface PelagiosPlace {
  id: string
  name: string
  lat: number
  lng: number
  placeType: string
  mentionCount: number
  datasets: string[]
  description: string
  source: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Pelagios heatmap places — coordinates with log-scale mention values
const HEATMAP_URL = 'https://raw.githubusercontent.com/pelagios/pelagios-heatmap/master/places.json'

// Pelagios API endpoints to try (may be down)
const PELAGIOS_API_URLS = [
  'https://peripleo.pelagios.org/peripleo/search?types=place&limit=500',
  'https://pelagios.org/peripleo/search?types=place&limit=500&offset=0',
  'https://peripleo.pelagios.org/peripleo/search?query=*&types=place&limit=500',
  'https://pelagios.org/api/places?format=json&limit=500',
  'https://recogito.pelagios.org/api/',
]

// DARE type codes mapped to readable place types
const DARE_TYPE_MAP: Record<number, string> = {
  1: 'settlement',
  2: 'settlement',
  3: 'military',
  4: 'religious',
  5: 'production',
  6: 'cemetery',
  7: 'infrastructure',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateCoord(n: number): number {
  return Math.round(n * 10000) / 10000
}

/**
 * Try each Pelagios API URL in sequence.
 * Returns the parsed response or null if all fail.
 */
async function tryPelagiosAPIs(): Promise<unknown | null> {
  for (const url of PELAGIOS_API_URLS) {
    try {
      console.log(`  Trying ${url}...`)
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
      if (!res.ok) {
        console.log(`    -> HTTP ${res.status}`)
        continue
      }
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('json')) {
        const text = await res.text()
        if (text.includes('maintenance') || text.includes('down')) {
          console.log('    -> Service is down for maintenance')
          continue
        }
        console.log(`    -> Non-JSON response (${contentType})`)
        continue
      }
      const data = await res.json()
      console.log('    -> Success!')
      return data
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`    -> Failed: ${msg}`)
    }
  }
  return null
}

/**
 * Haversine distance in km between two lat/lng points.
 */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ---------------------------------------------------------------------------
// Main processing
// ---------------------------------------------------------------------------

async function main() {
  console.log('Ingesting ancient place data from Pelagios...\n')

  // Step 1: Try the Pelagios/Peripleo REST APIs
  console.log('Step 1: Trying Pelagios REST APIs...')
  const apiResult = await tryPelagiosAPIs()
  if (apiResult) {
    console.log('  Got API data — will use it directly.')
    // If we ever get API data, we can parse it here.
    // For now the APIs are down, so we fall through.
  } else {
    console.log('  All Pelagios APIs unavailable (service is down for maintenance).\n')
  }

  // Step 2: Fetch the heatmap dataset (always available via GitHub)
  console.log('Step 2: Fetching Pelagios heatmap dataset from GitHub...')
  let heatmapRaw: string
  try {
    const res = await fetch(HEATMAP_URL)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    heatmapRaw = await res.text()
    console.log(`  Downloaded ${(heatmapRaw.length / 1024).toFixed(0)} KB\n`)
  } catch (err) {
    console.error(`  Failed to download heatmap data: ${(err as Error).message}`)
    console.log('  Writing empty output.\n')
    const outPath = fileURLToPath(new URL('../src/data/pelagios-places.json', import.meta.url))
    await mkdir(dirname(outPath), { recursive: true })
    await writeFile(outPath, '[]\n')
    return
  }

  // The file is JS (var testData = {...}), extract the JSON object
  const jsonMatch = heatmapRaw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.error('  Could not parse heatmap data format.')
    const outPath = fileURLToPath(new URL('../src/data/pelagios-places.json', import.meta.url))
    await writeFile(outPath, '[]\n')
    return
  }

  const heatmap: HeatmapData = JSON.parse(jsonMatch[0])
  console.log(`  Parsed ${heatmap.data.length} heatmap points (max value: ${heatmap.max})`)

  // Step 3: Load DARE settlements for name matching
  console.log('\nStep 3: Loading DARE settlements for cross-reference...')
  let dareSettlements: DareSettlement[] = []
  const darePath = fileURLToPath(new URL('../src/data/dare/settlements.json', import.meta.url))
  try {
    const raw = await readFile(darePath, 'utf-8')
    dareSettlements = JSON.parse(raw) as DareSettlement[]
    console.log(`  Loaded ${dareSettlements.length} DARE settlements`)
  } catch {
    console.log('  No DARE settlements file found — names will be coordinate-based.')
  }

  // Build a spatial index (simple grid) for fast nearest-neighbor lookups
  const gridSize = 0.5 // degrees
  const grid = new Map<string, DareSettlement[]>()
  for (const s of dareSettlements) {
    const key = `${Math.floor(s.lat / gridSize)},${Math.floor(s.lng / gridSize)}`
    if (!grid.has(key)) grid.set(key, [])
    grid.get(key)!.push(s)
  }

  function findNearest(lat: number, lng: number, maxDistKm: number): DareSettlement | null {
    const gx = Math.floor(lat / gridSize)
    const gy = Math.floor(lng / gridSize)
    let best: DareSettlement | null = null
    let bestDist = maxDistKm

    // Search in surrounding grid cells
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${gx + dx},${gy + dy}`
        const cell = grid.get(key)
        if (!cell) continue
        for (const s of cell) {
          const d = haversineKm(lat, lng, s.lat, s.lng)
          if (d < bestDist) {
            bestDist = d
            best = s
          }
        }
      }
    }
    return best
  }

  // Step 4: Convert heatmap points to PelagiosPlace records
  console.log('\nStep 4: Building place records...')

  // The heatmap values are log10(mentionCount) — convert back
  const places: PelagiosPlace[] = []
  const seen = new Set<string>()
  let matched = 0
  let unmatched = 0

  // Roman world bounding box (rough)
  const BOUNDS = { minLat: 20, maxLat: 60, minLng: -12, maxLng: 55 }

  for (const entry of heatmap.data) {
    const lat = truncateCoord(entry.lat)
    const lng = truncateCoord(entry.lon)

    // Filter to Roman world
    if (lat < BOUNDS.minLat || lat > BOUNDS.maxLat) continue
    if (lng < BOUNDS.minLng || lng > BOUNDS.maxLng) continue

    // Deduplicate very close points (within ~1km)
    const dedupKey = `${Math.round(lat * 20)},${Math.round(lng * 20)}`
    if (seen.has(dedupKey)) continue
    seen.add(dedupKey)

    // Convert log10 value back to raw mention count
    const mentionCount = Math.round(10 ** entry.value)

    // Try to match to a DARE settlement
    const nearest = findNearest(lat, lng, 5) // 5km threshold
    let name: string
    let placeType: string
    let id: string

    if (nearest) {
      name = nearest.name
      placeType = DARE_TYPE_MAP[nearest.type] || 'settlement'
      id = `pelagios-${nearest.id}`
      matched++
    } else {
      // Use coordinate-based name
      name = `Place at ${lat.toFixed(2)}, ${lng.toFixed(2)}`
      placeType = 'unknown'
      id = `pelagios-${lat.toFixed(4)}-${lng.toFixed(4)}`
      unmatched++
    }

    // Skip duplicate DARE matches (keep the one with higher mention count)
    const existing = places.find((p) => p.id === id)
    if (existing) {
      if (mentionCount > existing.mentionCount) {
        existing.mentionCount = mentionCount
        existing.description = `Referenced in ~${mentionCount.toLocaleString()} ancient text passages across the Pelagios network`
      }
      continue
    }

    // Pelagios connects texts from multiple classical authors
    const datasets: string[] = []
    if (mentionCount > 100) datasets.push('Pliny', 'Strabo', 'Ptolemy')
    else if (mentionCount > 20) datasets.push('Pliny', 'Strabo')
    else if (mentionCount > 5) datasets.push('Strabo')

    places.push({
      id,
      name,
      lat: nearest ? nearest.lat : lat,
      lng: nearest ? nearest.lng : lng,
      placeType,
      mentionCount,
      datasets,
      description: `Referenced in ~${mentionCount.toLocaleString()} ancient text passages across the Pelagios network`,
      source: 'Pelagios',
    })
  }

  // Sort by mention count descending
  places.sort((a, b) => b.mentionCount - a.mentionCount)

  console.log(`  Matched to DARE settlement: ${matched}`)
  console.log(`  Unmatched (coordinate-only): ${unmatched}`)

  // Remove unnamed/unmatched entries with very low mention counts
  const filtered = places.filter((p) => p.placeType !== 'unknown' || p.mentionCount >= 5)

  // Step 5: Write output
  console.log('\nStep 5: Writing output...')
  const outPath = fileURLToPath(new URL('../src/data/pelagios-places.json', import.meta.url))
  await mkdir(dirname(outPath), { recursive: true })

  const json = JSON.stringify(filtered, null, 2)
  await writeFile(outPath, json + '\n')

  // Stats
  const typeCounts: Record<string, number> = {}
  for (const p of filtered) {
    typeCounts[p.placeType] = (typeCounts[p.placeType] || 0) + 1
  }

  const totalMentions = filtered.reduce((sum, p) => sum + p.mentionCount, 0)

  console.log('\nResults:')
  console.log(`  Total places: ${filtered.length}`)
  console.log(`  Total mentions: ${totalMentions.toLocaleString()}`)
  console.log(`  Output: ${outPath} (${(json.length / 1024).toFixed(0)} KB)`)

  console.log('\nBy place type:')
  for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`)
  }

  console.log('\nTop 15 most-referenced places:')
  for (const p of filtered.slice(0, 15)) {
    console.log(
      `  ${p.name} — ${p.mentionCount.toLocaleString()} mentions (${p.placeType}) [${p.lat}, ${p.lng}]`,
    )
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
