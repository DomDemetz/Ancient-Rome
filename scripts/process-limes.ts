/**
 * Process DARE fortifications GeoJSON into limes.json with sector names and temporal data.
 *
 * Source: klokantech/roman-empire (extracted from DARE database)
 * License: CC BY-SA 3.0
 *
 * Usage: npx tsx scripts/process-limes.ts
 */

import { writeFile } from 'fs/promises'
import { fileURLToPath } from 'url'

const SOURCE_URL =
  'https://raw.githubusercontent.com/klokantech/roman-empire/master/data/fortifications.geojson'

interface RawFeature {
  type: 'Feature'
  properties: { Name: string | null }
  geometry: { type: 'LineString'; coordinates: number[][] }
}

interface RawCollection {
  type: 'FeatureCollection'
  features: RawFeature[]
}

interface SectorRule {
  sector: string
  startYear: number
  endYear: number
  match: (name: string | null, lat: number, lng: number) => boolean
}

// Classification rules: map features to named sectors with temporal data.
// Checked in order; first match wins.
const SECTOR_RULES: SectorRule[] = [
  // Hadrian's Wall — built 122 AD, maintained until ~410 AD
  {
    sector: "Hadrian's Wall",
    startYear: 122,
    endYear: 410,
    match: (name) =>
      name != null &&
      (name.startsWith('Wall Mile') || name.startsWith('Wall Milr') || name === 'VALLVM'),
  },
  // Antonine Wall — built 142 AD, abandoned ~162 AD
  {
    sector: 'Antonine Wall',
    startYear: 142,
    endYear: 162,
    match: (name) => name === 'VALLUM ANTONINI',
  },
  // Upper Germanic Limes — built ~83 AD under Domitian, fell ~260 AD
  {
    sector: 'Limes Germanicus',
    startYear: 83,
    endYear: 260,
    match: (name) =>
      name != null &&
      (name.startsWith('Limes Germania superior') ||
        name === 'FL. MOENVS (Main)' ||
        name === 'FL. NICER (Neckar)' ||
        name === 'Grinario - Clarenna'),
  },
  // Raetian Limes — similar period
  {
    sector: 'Limes Raeticus',
    startYear: 83,
    endYear: 260,
    match: (name) => name != null && name.startsWith('Limes Raetia'),
  },
  // Limes Transalutanus — built ~120 AD, abandoned ~245 AD
  {
    sector: 'Limes Transalutanus',
    startYear: 120,
    endYear: 245,
    match: (name) => name === 'Limes Transalutanus',
  },
  // Limes Alutanus — built ~106 AD (Trajan), abandoned ~271 AD (Aurelian withdrawal)
  {
    sector: 'Limes Alutanus',
    startYear: 106,
    endYear: 271,
    match: (name) => name === 'Limes Alutanus',
  },
  // Lower Danube Limes (Moesia Inferior) — generic "Limes" near Dobruja
  {
    sector: 'Limes Moesiae',
    startYear: 29,
    endYear: 400,
    match: (name, lat, lng) => name === 'Limes' && lat > 43 && lat < 46 && lng > 25 && lng < 30,
  },
  // Fossatum Africae — North African frontier, ~100–400 AD
  {
    sector: 'Fossatum Africae',
    startYear: 100,
    endYear: 400,
    match: (_name, lat, lng) => lat >= 29 && lat <= 37 && lng >= 4 && lng <= 11,
  },
  // Claustra Alpium Iuliarum — Alpine barrier, ~270–400 AD
  {
    sector: 'Claustra Alpium Iuliarum',
    startYear: 270,
    endYear: 400,
    match: (_name, lat, lng) => lat >= 45 && lat <= 47 && lng >= 13 && lng <= 15,
  },
  // Long Walls of Thrace / Anastasian Wall — near Constantinople
  {
    sector: 'Long Walls of Thrace',
    startYear: 400,
    endYear: 476,
    match: (_name, lat, lng) => lat >= 40.5 && lat <= 42 && lng >= 27 && lng <= 29,
  },
  // Egyptian frontier
  {
    sector: 'Limes Aegypti',
    startYear: -30,
    endYear: 400,
    match: (_name, lat, lng) => lat >= 28 && lat <= 32 && lng >= 29 && lng <= 33,
  },
  // Wall of Gorgan (Sasanian, not strictly Roman — but in DARE)
  {
    sector: 'Wall of Gorgan',
    startYear: 420,
    endYear: 476,
    match: (name) => name === 'Grand wall of AtG',
  },
]

function classifyFeature(name: string | null, lat: number, lng: number): SectorRule | null {
  for (const rule of SECTOR_RULES) {
    if (rule.match(name, lat, lng)) return rule
  }
  return null
}

async function main() {
  console.log('Fetching DARE fortifications data...')
  const resp = await fetch(SOURCE_URL)
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const raw = (await resp.json()) as RawCollection

  console.log(`  Raw features: ${raw.features.length}`)

  const features: Array<{
    type: 'Feature'
    properties: {
      sector: string
      name: string
      startYear: number
      endYear: number
    }
    geometry: { type: 'LineString'; coordinates: [number, number][] }
  }> = []

  let classified = 0
  let skipped = 0

  for (const f of raw.features) {
    const coords = f.geometry.coordinates
    const mid = coords[Math.floor(coords.length / 2)]
    const lat = mid[1]
    const lng = mid[0]

    const rule = classifyFeature(f.properties.Name, lat, lng)
    if (!rule) {
      skipped++
      continue
    }

    classified++
    features.push({
      type: 'Feature',
      properties: {
        sector: rule.sector,
        name: f.properties.Name ?? rule.sector,
        startYear: rule.startYear,
        endYear: rule.endYear,
      },
      geometry: {
        type: 'LineString',
        // Strip elevation (3rd coordinate) if present
        coordinates: coords.map(
          (c) =>
            [Math.round(c[0] * 10000) / 10000, Math.round(c[1] * 10000) / 10000] as [
              number,
              number,
            ],
        ),
      },
    })
  }

  console.log(`  Classified: ${classified}, Skipped: ${skipped}`)

  // Summary by sector
  const sectorCounts = new Map<string, number>()
  for (const f of features) {
    sectorCounts.set(f.properties.sector, (sectorCounts.get(f.properties.sector) || 0) + 1)
  }
  for (const [sector, count] of sectorCounts) {
    console.log(`    ${sector}: ${count} segments`)
  }

  const collection = { type: 'FeatureCollection' as const, features }
  const json = JSON.stringify(collection)
  const outPath = fileURLToPath(new URL('../src/data/dare/limes.json', import.meta.url))
  await writeFile(outPath, json + '\n')
  console.log(
    `\n✓ Limes: ${features.length} features, ${(json.length / 1024).toFixed(0)} KB → ${outPath}`,
  )
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
