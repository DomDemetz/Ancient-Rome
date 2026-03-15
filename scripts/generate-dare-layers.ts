/**
 * Script to fetch and process DARE (Digital Atlas of the Roman Empire) data.
 * Generates roads and settlements GeoJSON for the map.
 *
 * Usage: npx tsx scripts/generate-dare-layers.ts
 */

import { writeFile, readFile } from 'fs/promises'
import { fileURLToPath } from 'url'

const DARE_BASE = 'https://raw.githubusercontent.com/klokantech/roman-empire/master/data'

interface DareFeature {
  type: 'Feature'
  properties: Record<string, unknown>
  geometry: {
    type: string
    coordinates: unknown
  }
}

interface DareCollection {
  type: 'FeatureCollection'
  features: DareFeature[]
}

interface DareSettlement {
  id: string
  name: string
  modern: string
  greek?: string
  lat: number
  lng: number
  major: boolean
  type: number
  startYear: number
  endYear: number
}

function truncateCoord(n: number): number {
  return Math.round(n * 10000) / 10000
}

function truncateCoords(coords: unknown): unknown {
  if (typeof coords === 'number') return truncateCoord(coords)
  if (Array.isArray(coords)) return coords.map(truncateCoords)
  return coords
}

async function fetchJSON<T>(url: string): Promise<T> {
  console.log(`  Fetching ${url}...`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  return res.json() as Promise<T>
}

async function processRoads(): Promise<string> {
  const data = await fetchJSON<DareCollection>(`${DARE_BASE}/roads_low.geojson`)

  const features = data.features
    .filter((f) => {
      const geomType = f.geometry?.type
      return geomType === 'LineString' || geomType === 'MultiLineString'
    })
    .map((f) => ({
      type: 'Feature' as const,
      properties: {
        ...(f.properties?.Name ? { name: String(f.properties.Name) } : {}),
        ...(f.properties?.Major_or_M === '1' ? { major: true } : {}),
        ...(f.properties?.Known_or_a === '0' ? { unknown: true } : {}),
      },
      geometry: {
        type: f.geometry.type,
        coordinates: truncateCoords(f.geometry.coordinates),
      },
    }))

  const collection = {
    type: 'FeatureCollection' as const,
    features,
  }

  const json = JSON.stringify(collection)
  const outPath = fileURLToPath(new URL('../src/data/dare/roads.json', import.meta.url))
  await writeFile(outPath, json + '\n')
  console.log(`  ✓ Roads: ${features.length} features, ${(json.length / 1024).toFixed(0)} KB`)
  return outPath
}

async function processSettlements(): Promise<{ path: string; settlements: DareSettlement[] }> {
  // Fetch all three zoom-level datasets
  // places_low = major cities, places_medium = towns, places_high = minor sites
  // Each level has different entries (not subsets), so we combine all three
  const [dataLow, dataMedium, dataHigh] = await Promise.all([
    fetchJSON<DareCollection>(`${DARE_BASE}/places_low.geojson`),
    fetchJSON<DareCollection>(`${DARE_BASE}/places_medium.geojson`),
    fetchJSON<DareCollection>(`${DARE_BASE}/places_high.geojson`),
  ])

  const settlements: DareSettlement[] = []
  const seen = new Set<string>()

  function addFeatures(features: DareFeature[], major: boolean) {
    for (const f of features) {
      if (f.geometry?.type !== 'Point') continue
      const coords = f.geometry.coordinates as number[]
      if (!coords || coords.length < 2) continue

      const modern = String(f.properties?.modern || '')
      const latin = String(f.properties?.latin || '')
      const name = latin || modern
      if (!name) continue

      const id = String(f.properties?.id || `dare-${settlements.length}`)
      if (seen.has(id)) continue
      seen.add(id)

      const greek = f.properties?.greek ? String(f.properties.greek) : undefined
      const startYear = parseInt(String(f.properties?.startyear || '0'), 10) || 0
      const endYear = parseInt(String(f.properties?.endyear || '0'), 10) || 0
      const type = parseInt(String(f.properties?.type || '0'), 10) || 0

      const settlement: DareSettlement = {
        id,
        name,
        modern,
        lat: truncateCoord(coords[1]),
        lng: truncateCoord(coords[0]),
        major,
        type,
        startYear,
        endYear,
      }
      if (greek) settlement.greek = greek

      settlements.push(settlement)
    }
  }

  // Low-zoom places are the major ones (shown first to win dedup)
  addFeatures(dataLow.features, true)
  addFeatures(dataMedium.features, false)
  addFeatures(dataHigh.features, false)

  const json = JSON.stringify(settlements)
  const outPath = fileURLToPath(new URL('../src/data/dare/settlements.json', import.meta.url))
  await writeFile(outPath, json + '\n')
  console.log(
    `  ✓ Settlements: ${settlements.length} places (${settlements.filter((s) => s.major).length} major), ${(json.length / 1024).toFixed(0)} KB`,
  )
  return { path: outPath, settlements }
}

// Map curated city names to possible DARE latin/modern names
const CURATED_TO_DARE: Record<string, string[]> = {
  rome: ['Roma'],
  carthage: ['Carthago', 'Carthage'],
  alexandria: ['Alexandria'],
  athens: ['Athenae', 'Athens'],
  constantinople: ['Constantinopolis', 'Constantinople', 'Byzantium'],
  pompeii: ['Pompeii'],
  jerusalem: ['Hierosolyma', 'Aelia Capitolina', 'Jerusalem'],
  londinium: ['Londinium'],
  massilia: ['Massalia', 'Massilia'],
  syracuse: ['Syracusae', 'Syracuse'],
  antioch: ['Antiochia', 'Antioch'],
  ravenna: ['Ravenna'],
  mediolanum: ['Mediolanum'],
  brundisium: ['Brundisium'],
  hispalis: ['Hispalis'],
}

async function enrichCuratedCities(settlements: DareSettlement[]) {
  const locationsPath = fileURLToPath(
    new URL('../src/data/entities/locations.json', import.meta.url),
  )
  const raw = await readFile(locationsPath, 'utf-8')
  const locations = JSON.parse(raw) as Array<{
    id: string
    name: string
    coordinates: { lat: number; lng: number }
    [key: string]: unknown
  }>

  // Build name lookup (lowercase) from DARE settlements
  const dareLookup = new Map<string, DareSettlement>()
  for (const s of settlements) {
    dareLookup.set(s.name.toLowerCase(), s)
  }

  let updated = 0
  for (const loc of locations) {
    // Try direct name match first, then curated aliases
    const candidates = [
      loc.name.toLowerCase(),
      ...(CURATED_TO_DARE[loc.id]?.map((n) => n.toLowerCase()) || []),
    ]

    let match: DareSettlement | undefined
    for (const candidate of candidates) {
      match = dareLookup.get(candidate)
      if (match) break
    }

    if (match) {
      const oldLat = loc.coordinates.lat
      const oldLng = loc.coordinates.lng
      const dist = Math.sqrt((oldLat - match.lat) ** 2 + (oldLng - match.lng) ** 2)
      // Only update if DARE coordinates are close (within ~2 degrees) to avoid false matches
      if (dist < 2) {
        loc.coordinates = { lat: match.lat, lng: match.lng }
        if (oldLat !== match.lat || oldLng !== match.lng) {
          console.log(
            `  ✓ Updated ${loc.name}: (${oldLat}, ${oldLng}) → (${match.lat}, ${match.lng})`,
          )
          updated++
        }
      }
    } else {
      console.log(`  ✗ No DARE match for ${loc.name}`)
    }
  }

  await writeFile(locationsPath, JSON.stringify(locations, null, 2) + '\n')
  console.log(`  Updated ${updated} curated city coordinates from DARE data`)
}

// Approximate dates for when each Roman province was established and lost/reorganized
const PROVINCE_DATES: Record<string, { startYear: number; endYear: number }> = {
  Sicilia: { startYear: -241, endYear: 476 },
  'Sardinia et Corsica': { startYear: -238, endYear: 476 },
  Tarraconensis: { startYear: -197, endYear: 476 },
  Baetica: { startYear: -197, endYear: 476 },
  Lusitania: { startYear: -27, endYear: 476 },
  Narbonensis: { startYear: -121, endYear: 476 },
  'Africa Proconsularis': { startYear: -146, endYear: 476 },
  Achaia: { startYear: -146, endYear: 476 },
  Macedonia: { startYear: -146, endYear: 476 },
  Asia: { startYear: -133, endYear: 476 },
  Cilicia: { startYear: -64, endYear: 476 },
  Syria: { startYear: -64, endYear: 476 },
  'Bithynia et Pontus': { startYear: -63, endYear: 476 },
  'Creta et Cyrene': { startYear: -67, endYear: 476 },
  Cyprus: { startYear: -58, endYear: 476 },
  Aegyptus: { startYear: -30, endYear: 476 },
  'Galatia et Cappadocia': { startYear: -25, endYear: 476 },
  'Lycia et Pamphylia': { startYear: 43, endYear: 476 },
  Iudaea: { startYear: -6, endYear: 476 },
  Belgica: { startYear: -27, endYear: 476 },
  Lugdunensis: { startYear: -27, endYear: 476 },
  Aquitania: { startYear: -27, endYear: 476 },
  'Germania Superior': { startYear: 83, endYear: 476 },
  'Germania Inferior': { startYear: 83, endYear: 476 },
  'Alpes Graiae et Poeninae': { startYear: -15, endYear: 476 },
  'Alpes Cottiae': { startYear: -15, endYear: 476 },
  'Alpes Maritimae': { startYear: -14, endYear: 476 },
  Raetia: { startYear: -15, endYear: 476 },
  Noricum: { startYear: -15, endYear: 476 },
  'Pannonia Superior': { startYear: 9, endYear: 476 },
  'Pannonia Inferior': { startYear: 9, endYear: 476 },
  Dalmatia: { startYear: -27, endYear: 476 },
  'Moesia Superior': { startYear: 86, endYear: 476 },
  'Moesia Inferior': { startYear: 86, endYear: 476 },
  Thracia: { startYear: 46, endYear: 476 },
  Dacia: { startYear: 106, endYear: 271 },
  Britannia: { startYear: 43, endYear: 410 },
  Numidia: { startYear: -46, endYear: 476 },
  'Mauretania Caesariensis': { startYear: 40, endYear: 476 },
  'Mauretania Tingitana': { startYear: 40, endYear: 476 },
  Arabia: { startYear: 106, endYear: 476 },
  'Armenia Mesopotamia': { startYear: 114, endYear: 476 },
  // Italian Augustan regions (I–XI)
  I: { startYear: -27, endYear: 476 },
  II: { startYear: -27, endYear: 476 },
  III: { startYear: -27, endYear: 476 },
  IV: { startYear: -27, endYear: 476 },
  V: { startYear: -27, endYear: 476 },
  VI: { startYear: -27, endYear: 476 },
  VII: { startYear: -27, endYear: 476 },
  VIII: { startYear: -27, endYear: 476 },
  IX: { startYear: -27, endYear: 476 },
  X: { startYear: -27, endYear: 476 },
  XI: { startYear: -27, endYear: 476 },
}

const DEFAULT_PROVINCE_DATES = { startYear: -27, endYear: 476 }

async function processProvinces(): Promise<string> {
  const data = await fetchJSON<DareCollection>(`${DARE_BASE}/provinces.geojson`)

  const features = data.features
    .filter((f) => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon')
    .map((f) => {
      const name = String(f.properties?.name || '')
      const dates = PROVINCE_DATES[name] || DEFAULT_PROVINCE_DATES
      return {
        type: 'Feature' as const,
        properties: {
          name,
          startYear: dates.startYear,
          endYear: dates.endYear,
        },
        geometry: {
          type: f.geometry.type,
          coordinates: truncateCoords(f.geometry.coordinates),
        },
      }
    })

  const collection = { type: 'FeatureCollection' as const, features }
  const json = JSON.stringify(collection)
  const outPath = fileURLToPath(new URL('../src/data/dare/provinces.json', import.meta.url))
  await writeFile(outPath, json + '\n')
  console.log(`  ✓ Provinces: ${features.length} features, ${(json.length / 1024).toFixed(0)} KB`)
  return outPath
}

async function processFortifications(): Promise<string> {
  const data = await fetchJSON<DareCollection>(`${DARE_BASE}/fortifications.geojson`)

  const features = data.features
    .filter((f) => f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString')
    .map((f) => ({
      type: 'Feature' as const,
      properties: {
        ...(f.properties?.Name ? { name: String(f.properties.Name) } : {}),
      },
      geometry: {
        type: f.geometry.type,
        coordinates: truncateCoords(f.geometry.coordinates),
      },
    }))

  const collection = { type: 'FeatureCollection' as const, features }
  const json = JSON.stringify(collection)
  const outPath = fileURLToPath(new URL('../src/data/dare/fortifications.json', import.meta.url))
  await writeFile(outPath, json + '\n')
  console.log(
    `  ✓ Fortifications: ${features.length} features, ${(json.length / 1024).toFixed(0)} KB`,
  )
  return outPath
}

async function processWater(): Promise<string> {
  const [rivers, lakes] = await Promise.all([
    fetchJSON<DareCollection>(`${DARE_BASE}/10m_rivers_lake_centerlines.geojson`),
    fetchJSON<DareCollection>(`${DARE_BASE}/10m_lakes.geojson`),
  ])

  const riverFeatures = rivers.features
    .filter((f) => f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString')
    .map((f) => ({
      type: 'Feature' as const,
      properties: {
        kind: 'river' as const,
        ...(f.properties?.latin ? { name: String(f.properties.latin) } : {}),
        ...(f.properties?.modern ? { modern: String(f.properties.modern) } : {}),
      },
      geometry: {
        type: f.geometry.type,
        coordinates: truncateCoords(f.geometry.coordinates),
      },
    }))

  const lakeFeatures = lakes.features
    .filter((f) => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon')
    .map((f) => ({
      type: 'Feature' as const,
      properties: {
        kind: 'lake' as const,
        ...(f.properties?.latin ? { name: String(f.properties.latin) } : {}),
        ...(f.properties?.modern ? { modern: String(f.properties.modern) } : {}),
      },
      geometry: {
        type: f.geometry.type,
        coordinates: truncateCoords(f.geometry.coordinates),
      },
    }))

  const collection = {
    type: 'FeatureCollection' as const,
    features: [...riverFeatures, ...lakeFeatures],
  }
  const json = JSON.stringify(collection)
  const outPath = fileURLToPath(new URL('../src/data/dare/water.json', import.meta.url))
  await writeFile(outPath, json + '\n')
  console.log(
    `  ✓ Water: ${riverFeatures.length} rivers + ${lakeFeatures.length} lakes, ${(json.length / 1024).toFixed(0)} KB`,
  )
  return outPath
}

async function processProvinceLabels(): Promise<string> {
  const data = await fetchJSON<DareCollection>(`${DARE_BASE}/provinces_label.geojson`)

  const labels = data.features
    .filter((f) => f.geometry?.type === 'Point')
    .map((f) => {
      const name = String(f.properties?.name || '')
      const coords = f.geometry.coordinates as number[]
      const dates = PROVINCE_DATES[name] || DEFAULT_PROVINCE_DATES
      return {
        name,
        lat: truncateCoord(coords[1]),
        lng: truncateCoord(coords[0]),
        startYear: dates.startYear,
        endYear: dates.endYear,
      }
    })
    .filter((l) => l.name)

  const json = JSON.stringify(labels)
  const outPath = fileURLToPath(new URL('../src/data/dare/province-labels.json', import.meta.url))
  await writeFile(outPath, json + '\n')
  console.log(`  ✓ Province labels: ${labels.length} labels, ${(json.length / 1024).toFixed(0)} KB`)
  return outPath
}

async function main() {
  console.log('Generating DARE layers...\n')

  console.log('Processing roads...')
  await processRoads()

  console.log('\nProcessing settlements...')
  const { settlements } = await processSettlements()

  console.log('\nProcessing provinces...')
  await processProvinces()

  console.log('\nProcessing province labels...')
  await processProvinceLabels()

  console.log('\nProcessing fortifications...')
  await processFortifications()

  console.log('\nProcessing water (rivers & lakes)...')
  await processWater()

  console.log('\nEnriching curated city coordinates...')
  await enrichCuratedCities(settlements)

  console.log('\n✓ DARE layer generation complete')
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
