/**
 * Script to ingest ORBIS v2 transport network data from GitHub
 * and generate a trade network dataset for the Ancient Rome map.
 *
 * Source: https://github.com/emeeks/orbis_v2
 *
 * Usage: npx tsx scripts/ingest-orbis.ts
 */

import { writeFile, mkdir } from 'fs/promises'

const SITES_URL = 'https://raw.githubusercontent.com/emeeks/orbis_v2/master/sites_extended.csv'
const ROAD_ROUTES_URL =
  'https://raw.githubusercontent.com/emeeks/orbis_v2/master/base_routes.geojson'
const ALL_ROUTES_URL = 'https://raw.githubusercontent.com/emeeks/orbis_v2/master/new_routes.geojson'

const OUTPUT_PATH = 'src/data/trade/orbis.json'

interface RawSite {
  id: number
  label: string
  rank: number
  x: number
  y: number
  province: string
  modern: string
}

interface TradeNode {
  id: string
  name: string
  lat: number
  lng: number
  siteType: string
  province: string
  modern: string
}

interface TradeRoute {
  id: string
  from: string
  to: string
  transportType: 'road' | 'sea' | 'river'
  distanceKm: number
  coordinates: [number, number][]
}

// Map ORBIS rank values to our site types
function classifySite(rank: number, label: string): string {
  // Coastal / port heuristics based on known major ports
  const portNames = new Set([
    'Ostia/Portus',
    'Alexandria',
    'Carthago',
    'Puteoli',
    'Brundisium',
    'Massilia',
    'Gades',
    'Tarraco',
    'Londinium',
    'Aquileia',
    'Ephesus',
    'Corinthus',
    'Athenae',
    'Piraeus',
    'Antiocheia',
    'Caesarea Maritima',
    'Lepcis Magna',
    'Thessalonica',
    'Dyrrhachium',
    'Ravenna',
    'Genua',
    'Neapolis',
    'Syracusae',
    'Panormus',
    'Smyrna',
    'Pergamum',
    'Byzantium',
    'Constantinopolis',
    'Tyrus',
    'Berytus',
    'Laodicea',
    'Rhodos',
    'Salamis',
    'Paphos',
    'Cyrene',
    'Hippo Regius',
    'Hadrumetum',
    'Tingis',
    'Narbo',
    'Arelate',
    'Forum Iulii',
    'Misenum',
    'Barcino',
    'Carthago Nova',
    'Hispalis',
    'Seleukeia Pieria',
    'Trapezus',
    'Sinope',
    'Amisus',
    'Heraclea Pontica',
    'Nicomedia',
    'Nicaea',
    'Cyzicus',
    'Miletus',
    'Halicarnassus',
    'Cnidus',
    'Patara',
    'Myra',
    'Side',
    'Attalea',
    'Tarsus',
  ])

  if (rank >= 100 && portNames.has(label)) return 'major_port'
  if (portNames.has(label)) return 'port'
  if (rank >= 100) return 'city'
  if (rank >= 90) return 'city'
  if (rank >= 80) return 'port' // many rank-80 sites are smaller ports or cities
  return 'junction'
}

// Map ORBIS route type to our transport types
function classifyRoute(orbisType: string): 'road' | 'sea' | 'river' {
  switch (orbisType) {
    case 'road':
      return 'road'
    case 'upstream':
    case 'downstream':
      return 'river'
    case 'coastal':
    case 'overseas':
    case 'ferry':
      return 'sea'
    default:
      return 'road'
  }
}

// Estimate distance from coordinates using Haversine formula
function haversineKm(coords: [number, number][]): number {
  let totalKm = 0
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i - 1]
    const [lon2, lat2] = coords[i]
    const R = 6371
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    totalKm += R * c
  }
  return Math.round(totalKm)
}

function toKebabId(label: string): string {
  return label
    .toLowerCase()
    .replace(/[()/]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function parseCsv(text: string): RawSite[] {
  // Handle \r, \n, or \r\n line endings
  const lines = text.trim().split(/\r\n|\r|\n/)
  const header = lines[0].split(',')

  const idIdx = header.indexOf('id')
  const labelIdx = header.indexOf('label')
  const rankIdx = header.indexOf('rank')
  const xIdx = header.indexOf('x')
  const yIdx = header.indexOf('y')
  const provinceIdx = header.indexOf('province')
  const modernIdx = header.indexOf('modern')

  const sites: RawSite[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const label = cols[labelIdx]?.trim()
    const rank = parseInt(cols[rankIdx], 10)

    // Skip placeholder entries (label 'x' with rank 6)
    if (!label || label === 'x' || rank <= 6) continue

    sites.push({
      id: parseInt(cols[idIdx], 10),
      label,
      rank,
      x: parseFloat(cols[xIdx]),
      y: parseFloat(cols[yIdx]),
      province: cols[provinceIdx]?.trim() || '',
      modern: cols[modernIdx]?.trim() || '',
    })
  }

  return sites
}

// Normalize ORBIS IDs: new_routes.geojson uses offset IDs (250xxx, 350xxx, 450xxx)
// that map back to base site IDs (50xxx)
function normalizeOrbisId(id: number): number {
  if (id >= 400000) return id - 400000
  if (id >= 300000) return id - 300000
  if (id >= 200000) return id - 200000
  if (id >= 100000) return id - 100000
  return id
}

type RoutesGeoJson = {
  features: Array<{
    properties: {
      sid: number
      tid: number
      t: string
      e: number
      s: number
      gid?: number
      m?: string
    }
    geometry: { type: string; coordinates: [number, number][] }
  }>
}

function simplifyCoords(coords: [number, number][]): [number, number][] {
  if (coords.length > 20) {
    const step = Math.ceil(coords.length / 15)
    const simplified: [number, number][] = []
    for (let i = 0; i < coords.length; i += step) {
      simplified.push(coords[i])
    }
    if (simplified[simplified.length - 1] !== coords[coords.length - 1]) {
      simplified.push(coords[coords.length - 1])
    }
    return simplified
  }
  return coords
}

async function main() {
  console.log('Fetching ORBIS v2 sites data...')
  const sitesResp = await fetch(SITES_URL)
  if (!sitesResp.ok) throw new Error(`Failed to fetch sites: ${sitesResp.status}`)
  const sitesText = await sitesResp.text()

  console.log('Fetching ORBIS v2 road routes...')
  const roadResp = await fetch(ROAD_ROUTES_URL)
  if (!roadResp.ok) throw new Error(`Failed to fetch road routes: ${roadResp.status}`)
  const roadJson = (await roadResp.json()) as RoutesGeoJson

  console.log('Fetching ORBIS v2 all routes (sea, river, coastal)...')
  const allResp = await fetch(ALL_ROUTES_URL)
  if (!allResp.ok) throw new Error(`Failed to fetch all routes: ${allResp.status}`)
  const allJson = (await allResp.json()) as RoutesGeoJson

  // Parse sites
  const rawSites = parseCsv(sitesText)
  console.log(`Parsed ${rawSites.length} sites (excluding placeholders)`)

  // Build numeric ID -> kebab ID mapping
  const numToKebab = new Map<number, string>()
  const kebabCount = new Map<string, number>()

  for (const s of rawSites) {
    let kebab = toKebabId(s.label)
    const count = kebabCount.get(kebab) || 0
    kebabCount.set(kebab, count + 1)
    if (count > 0) kebab = `${kebab}-${count}`
    numToKebab.set(s.id, kebab)
  }

  // Convert sites
  const sites: TradeNode[] = rawSites.map((s) => ({
    id: numToKebab.get(s.id)!,
    name: s.label,
    lat: s.y,
    lng: s.x,
    siteType: classifySite(s.rank, s.label),
    province: s.province,
    modern: s.modern,
  }))

  // Build set of valid site IDs for filtering routes
  const validSiteIds = new Set(rawSites.map((s) => s.id))

  // Process routes from both files
  const seenRoutes = new Set<string>()
  const routes: TradeRoute[] = []
  let routeIdx = 0

  function processFeatures(features: RoutesGeoJson['features'], useNormalize: boolean) {
    for (const feature of features) {
      const rawSid = feature.properties.sid
      const rawTid = feature.properties.tid
      const t = feature.properties.t

      const sid = useNormalize ? normalizeOrbisId(rawSid) : rawSid
      const tid = useNormalize ? normalizeOrbisId(rawTid) : rawTid

      if (!validSiteIds.has(sid) || !validSiteIds.has(tid)) continue

      const fromId = numToKebab.get(sid)!
      const toId = numToKebab.get(tid)!
      const transportType = classifyRoute(t)

      // Canonical key for deduplication
      let key: string
      if (transportType === 'river') {
        key = `${fromId}>${toId}:${transportType}`
      } else {
        const sorted = [fromId, toId].sort()
        key = `${sorted[0]}>${sorted[1]}:${transportType}`
      }

      if (seenRoutes.has(key)) continue
      seenRoutes.add(key)

      const coords = feature.geometry.coordinates as [number, number][]

      routeIdx++
      routes.push({
        id: `route-${String(routeIdx).padStart(4, '0')}`,
        from: fromId,
        to: toId,
        transportType,
        distanceKm: haversineKm(coords),
        coordinates: simplifyCoords(coords),
      })
    }
  }

  // Process road routes from base_routes.geojson (uses raw 50xxx IDs)
  processFeatures(roadJson.features, false)
  console.log(`After road routes: ${routes.length} routes`)

  // Process all routes from new_routes.geojson (uses offset IDs for sea/coastal)
  // Only add non-road routes to avoid duplicating roads
  const nonRoadFeatures = allJson.features.filter((f) => f.properties.t !== 'road')
  processFeatures(nonRoadFeatures, true)
  console.log(`After adding sea/river routes: ${routes.length} routes`)

  console.log(`\nProcessed ${routes.length} total routes`)
  console.log(`  Road: ${routes.filter((r) => r.transportType === 'road').length}`)
  console.log(`  Sea: ${routes.filter((r) => r.transportType === 'sea').length}`)
  console.log(`  River: ${routes.filter((r) => r.transportType === 'river').length}`)

  const output = { sites, routes }

  // Ensure output directory exists
  await mkdir('src/data/trade', { recursive: true })
  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8')

  const sizeKb = Math.round(Buffer.byteLength(JSON.stringify(output, null, 2)) / 1024)
  console.log(`\nWrote ${OUTPUT_PATH} (${sizeKb} KB)`)
  console.log(`  ${sites.length} sites, ${routes.length} routes`)
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
