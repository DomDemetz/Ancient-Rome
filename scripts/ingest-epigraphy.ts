/**
 * Script to fetch Roman inscription findspot data from the
 * Epigraphic Database Heidelberg (EDH) and aggregate into density clusters.
 *
 * Strategy:
 *   1. Fetch all geography records from EDH (~30k findspots with coordinates)
 *   2. Fetch inscription counts per province to weight clusters
 *   3. Aggregate findspots into 0.5-degree grid cells
 *   4. Distribute inscription counts proportionally across grid cells per province
 *   5. Split into century-based time periods
 *
 * Usage: npx tsx scripts/ingest-epigraphy.ts
 */

import { writeFile as writeFileAsync, mkdir as mkdirAsync, readFile } from 'fs/promises'
import { fileURLToPath } from 'url'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GeoRecord {
  id: string
  coordinates: string | null
  province: string | null
  findspot_ancient: string | null
  findspot_modern: string | null
  country: string | null
}

interface EpigraphyCluster {
  id: string
  lat: number
  lng: number
  count: number
  province: string
  startYear: number
  endYear: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GEO_API = 'https://edh.ub.uni-heidelberg.de/data/api/geographie/suche'
const INSCR_API = 'https://edh.ub.uni-heidelberg.de/data/api/inschrift/suche'

const PAGE_SIZE = 200
const GRID_SIZE = 0.5 // degrees

// Time periods for splitting clusters
const TIME_PERIODS = [
  { startYear: -200, endYear: -100, label: 'republic-early' },
  { startYear: -100, endYear: 1, label: 'republic-late' },
  { startYear: 1, endYear: 100, label: 'c1' },
  { startYear: 100, endYear: 200, label: 'c2' },
  { startYear: 200, endYear: 300, label: 'c3' },
  { startYear: 300, endYear: 400, label: 'c4' },
]

// Province name normalization
const PROVINCE_NORMALIZE: Record<string, string> = {
  Achaia: 'Achaia',
  Aegyptus: 'Aegyptus',
  'Africa proconsularis': 'Africa Proconsularis',
  'Africa Proconsularis': 'Africa Proconsularis',
  'Alpes Cottiae': 'Alpes Cottiae',
  'Alpes Graiae': 'Alpes Graiae',
  'Alpes Maritimae': 'Alpes Maritimae',
  'Alpes Poeninae': 'Alpes Poeninae',
  Arabia: 'Arabia',
  Armenia: 'Armenia',
  Asia: 'Asia',
  Baetica: 'Baetica',
  Barbaricum: 'Barbaricum',
  Belgica: 'Belgica',
  'Bithynia et Pontus': 'Bithynia et Pontus',
  Britannia: 'Britannia',
  Cappadocia: 'Cappadocia',
  Cilicia: 'Cilicia',
  Corsica: 'Corsica',
  'Creta et Cyrene': 'Creta et Cyrene',
  Dacia: 'Dacia',
  Dalmatia: 'Dalmatia',
  Epirus: 'Epirus',
  'Etruria (Regio VII)': 'Italia',
  Galatia: 'Galatia',
  'Gallia Narbonensis': 'Gallia Narbonensis',
  'Germania inferior': 'Germania Inferior',
  'Germania Inferior': 'Germania Inferior',
  'Germania superior': 'Germania Superior',
  'Germania Superior': 'Germania Superior',
  'Hispania citerior': 'Hispania Citerior',
  'Hispania Citerior': 'Hispania Citerior',
  Italia: 'Italia',
  'Latium et Campania (Regio I)': 'Italia',
  Lugdunensis: 'Lugdunensis',
  Lusitania: 'Lusitania',
  'Lycia et Pamphylia': 'Lycia et Pamphylia',
  Macedonia: 'Macedonia',
  'Mauretania Caesariensis': 'Mauretania Caesariensis',
  'Mauretania Tingitana': 'Mauretania Tingitana',
  Mesopotamia: 'Mesopotamia',
  'Moesia inferior': 'Moesia Inferior',
  'Moesia Inferior': 'Moesia Inferior',
  'Moesia superior': 'Moesia Superior',
  'Moesia Superior': 'Moesia Superior',
  Noricum: 'Noricum',
  Numidia: 'Numidia',
  Palaestina: 'Palaestina',
  'Pannonia inferior': 'Pannonia Inferior',
  'Pannonia Inferior': 'Pannonia Inferior',
  'Pannonia superior': 'Pannonia Superior',
  'Pannonia Superior': 'Pannonia Superior',
  Raetia: 'Raetia',
  Roma: 'Italia',
  Sardinia: 'Sardinia',
  Sicilia: 'Sicilia',
  Syria: 'Syria',
  Thracia: 'Thracia',
}

// Approximate inscription count distribution by century (based on EDH research)
// Most Roman inscriptions date from 1st-3rd century CE
const PERIOD_WEIGHT: Record<string, number> = {
  'republic-early': 0.03,
  'republic-late': 0.1,
  c1: 0.25,
  c2: 0.35,
  c3: 0.2,
  c4: 0.07,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeProvince(raw: string | null): string {
  if (!raw) return 'Unknown'
  // Try direct match first
  if (PROVINCE_NORMALIZE[raw]) return PROVINCE_NORMALIZE[raw]
  // Try case-insensitive
  for (const [key, val] of Object.entries(PROVINCE_NORMALIZE)) {
    if (key.toLowerCase() === raw.toLowerCase()) return val
  }
  // Return as-is with title case
  return raw
}

function parseCoordinates(coordStr: string | null): { lat: number; lng: number } | null {
  if (!coordStr) return null
  const parts = coordStr.split(',').map((s) => parseFloat(s.trim()))
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null
  // EDH format is "lat,lng"
  const lat = parts[0]
  const lng = parts[1]
  // Basic bounds check for Roman Empire
  if (lat < 20 || lat > 60 || lng < -15 || lng > 50) return null
  return { lat, lng }
}

function gridKey(lat: number, lng: number): string {
  const gLat = Math.round(lat / GRID_SIZE) * GRID_SIZE
  const gLng = Math.round(lng / GRID_SIZE) * GRID_SIZE
  return `${gLat.toFixed(1)}_${gLng.toFixed(1)}`
}

function gridCenter(key: string): { lat: number; lng: number } {
  const [latStr, lngStr] = key.split('_')
  return { lat: parseFloat(latStr), lng: parseFloat(lngStr) }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`)
  }
  return res.json()
}

async function fetchAllGeography(): Promise<GeoRecord[]> {
  console.log('Fetching geography records from EDH...')

  // First, get the total count
  const firstPage = await fetchJson(`${GEO_API}?limit=1`)
  const total = parseInt(firstPage.total, 10)
  console.log(`  Total geography records: ${total}`)

  const allRecords: GeoRecord[] = []
  let offset = 0

  while (offset < total) {
    const url = `${GEO_API}?limit=${PAGE_SIZE}&offset=${offset}`
    try {
      const data = await fetchJson(url)
      const items = data.items || []
      for (const item of items) {
        allRecords.push({
          id: item.id || '',
          coordinates: item.coordinates || null,
          province: item.province || null,
          findspot_ancient: item.findspot_ancient || null,
          findspot_modern: item.findspot_modern || null,
          country: item.country || null,
        })
      }
      offset += PAGE_SIZE
      if (offset % 2000 === 0 || offset >= total) {
        console.log(`  Fetched ${Math.min(offset, total)}/${total} geography records...`)
      }
      // Be polite to the server
      await sleep(100)
    } catch (err) {
      console.warn(`  Warning: failed to fetch offset ${offset}: ${(err as Error).message}`)
      // Skip this batch and continue
      offset += PAGE_SIZE
      await sleep(500)
    }
  }

  console.log(`  Got ${allRecords.length} total geography records`)
  return allRecords
}

async function fetchInscriptionCountForProvince(provinceCode: string): Promise<number> {
  try {
    const url = `${INSCR_API}?provinz=${encodeURIComponent(provinceCode)}&limit=1`
    const data = await fetchJson(url)
    return parseInt(data.total, 10) || 0
  } catch {
    return 0
  }
}

// Map of EDH province abbreviation codes
const PROVINCE_CODES: Record<string, string> = {
  Achaia: 'Ach',
  Aegyptus: 'Aeg',
  'Africa Proconsularis': 'Afr',
  Arabia: 'Ara',
  Asia: 'Asi',
  Baetica: 'Bae',
  Belgica: 'Bel',
  'Bithynia et Pontus': 'BiP',
  Britannia: 'Bri',
  Cappadocia: 'Cap',
  Cilicia: 'Cil',
  'Creta et Cyrene': 'CrC',
  Dacia: 'Dac',
  Dalmatia: 'Dal',
  Epirus: 'Epi',
  Galatia: 'Gal',
  'Gallia Narbonensis': 'GaN',
  'Germania Inferior': 'GeI',
  'Germania Superior': 'GeS',
  'Hispania Citerior': 'HiC',
  Italia: 'Ita',
  Lugdunensis: 'Lug',
  Lusitania: 'Lus',
  'Lycia et Pamphylia': 'LyP',
  Macedonia: 'Mak',
  'Mauretania Caesariensis': 'MaC',
  'Mauretania Tingitana': 'MaT',
  'Moesia Inferior': 'MoI',
  'Moesia Superior': 'MoS',
  Noricum: 'Nor',
  Numidia: 'Num',
  Palaestina: 'Pal',
  'Pannonia Inferior': 'PaI',
  'Pannonia Superior': 'PaS',
  Raetia: 'Rae',
  Sardinia: 'Sar',
  Sicilia: 'Sic',
  Syria: 'Syr',
  Thracia: 'Thr',
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

interface GridCell {
  lat: number
  lng: number
  province: string
  findspotCount: number
}

function aggregateToGrid(records: GeoRecord[]): Map<string, GridCell> {
  const grid = new Map<string, GridCell>()

  let withCoords = 0
  let skipped = 0

  for (const rec of records) {
    const coords = parseCoordinates(rec.coordinates)
    if (!coords) {
      skipped++
      continue
    }
    withCoords++
    const key = gridKey(coords.lat, coords.lng)
    const province = normalizeProvince(rec.province)

    const cellKey = `${key}|${province}`
    const existing = grid.get(cellKey)
    if (existing) {
      existing.findspotCount++
    } else {
      const center = gridCenter(key)
      grid.set(cellKey, {
        lat: center.lat,
        lng: center.lng,
        province,
        findspotCount: 1,
      })
    }
  }

  console.log(`\n  Records with valid coordinates: ${withCoords}`)
  console.log(`  Records skipped (no/invalid coords): ${skipped}`)
  console.log(`  Unique grid cells: ${grid.size}`)

  return grid
}

function buildClusters(
  grid: Map<string, GridCell>,
  provinceCounts: Map<string, number>,
): EpigraphyCluster[] {
  const clusters: EpigraphyCluster[] = []

  // Sum findspots per province for proportional distribution
  const provinceFindspots = new Map<string, number>()
  for (const cell of grid.values()) {
    provinceFindspots.set(
      cell.province,
      (provinceFindspots.get(cell.province) || 0) + cell.findspotCount,
    )
  }

  for (const cell of grid.values()) {
    // Get total inscription count for this province
    const totalInscriptions = provinceCounts.get(cell.province) || 0
    const totalFindspots = provinceFindspots.get(cell.province) || 1

    // Distribute inscriptions proportionally based on findspot density
    // If we don't have inscription counts, use findspot count as proxy (x3 multiplier)
    const cellInscriptions =
      totalInscriptions > 0
        ? Math.round((cell.findspotCount / totalFindspots) * totalInscriptions)
        : cell.findspotCount * 3

    if (cellInscriptions < 1) continue

    // Split across time periods
    for (const period of TIME_PERIODS) {
      const weight = PERIOD_WEIGHT[period.label] || 0.15
      const count = Math.max(1, Math.round(cellInscriptions * weight))

      const id = `edh-${cell.lat.toFixed(1)}-${cell.lng.toFixed(1)}-${period.label}`
        .replace(/\./g, 'p')
        .replace(/--/g, 'n')

      clusters.push({
        id,
        lat: Math.round(cell.lat * 1000) / 1000,
        lng: Math.round(cell.lng * 1000) / 1000,
        count,
        province: cell.province,
        startYear: period.startYear,
        endYear: period.endYear,
      })
    }
  }

  return clusters
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Ingesting Roman inscription data from Epigraphic Database Heidelberg (EDH)...\n')

  const outDir = fileURLToPath(new URL('../src/data/epigraphy', import.meta.url))
  await mkdirAsync(outDir, { recursive: true })
  const outPath = fileURLToPath(new URL('../src/data/epigraphy/epigraphy.json', import.meta.url))

  let geoRecords: GeoRecord[]
  try {
    geoRecords = await fetchAllGeography()
  } catch (err) {
    console.error(`\nEDH geography API access failed: ${(err as Error).message}`)
    console.log('Keeping existing epigraphy clusters.')
    // Verify existing file is still there
    try {
      const existing = await readFile(outPath, 'utf-8')
      const parsed = JSON.parse(existing)
      console.log(`Existing file has ${parsed.length} clusters.`)
    } catch {
      console.log('No existing file found either.')
    }
    return
  }

  if (geoRecords.length === 0) {
    console.error('No geography records retrieved. Keeping existing data.')
    return
  }

  // Aggregate geography records into grid cells
  console.log('\nAggregating findspots into grid cells...')
  const grid = aggregateToGrid(geoRecords)

  // Get unique provinces
  const provinces = new Set<string>()
  for (const cell of grid.values()) {
    provinces.add(cell.province)
  }
  console.log(`\n  Provinces found: ${provinces.size}`)

  // Fetch inscription counts per province
  console.log('\nFetching inscription counts per province...')
  const provinceCounts = new Map<string, number>()
  let totalInscriptions = 0

  for (const province of provinces) {
    const code = PROVINCE_CODES[province]
    if (code) {
      const count = await fetchInscriptionCountForProvince(code)
      if (count > 0) {
        provinceCounts.set(province, count)
        totalInscriptions += count
        console.log(`  ${province}: ${count} inscriptions`)
      }
      await sleep(150)
    }
  }
  console.log(`  Total inscriptions from queried provinces: ${totalInscriptions}`)

  // Build clusters
  console.log('\nBuilding density clusters...')
  const clusters = buildClusters(grid, provinceCounts)

  // Sort by province, then by count descending
  clusters.sort((a, b) => {
    if (a.province !== b.province) return a.province.localeCompare(b.province)
    return b.count - a.count
  })

  // Write output
  const json = JSON.stringify(clusters, null, 2)
  await writeFileAsync(outPath, json + '\n')

  // Stats
  const totalCount = clusters.reduce((sum, c) => sum + c.count, 0)
  const provinceSummary = new Map<string, number>()
  for (const c of clusters) {
    provinceSummary.set(c.province, (provinceSummary.get(c.province) || 0) + c.count)
  }

  console.log('\n=== Results ===')
  console.log(`  Total clusters: ${clusters.length}`)
  console.log(`  Total inscription count: ${totalCount}`)
  console.log(`  Output: ${outPath} (${(json.length / 1024).toFixed(0)} KB)`)
  console.log('\nTop provinces by inscription count:')
  const sorted = [...provinceSummary.entries()].sort((a, b) => b[1] - a[1])
  for (const [prov, count] of sorted.slice(0, 15)) {
    console.log(`  ${prov}: ${count}`)
  }

  console.log('\nSample clusters:')
  for (const c of clusters.slice(0, 5)) {
    console.log(
      `  ${c.id}: ${c.count} inscriptions at [${c.lat}, ${c.lng}] (${c.province}, ${c.startYear}-${c.endYear})`,
    )
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
