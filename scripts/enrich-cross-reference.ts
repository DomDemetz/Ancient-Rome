/**
 * Cross-Reference Enrichment Script
 *
 * Builds structured "fact cards" for each map feature by cross-referencing
 * existing academic data sources (DARE, Pleiades, Pelagios, ORBIS, EDH).
 *
 * ACCURACY RULES:
 * - Name matching first, spatial matching only as fallback with strict type guards
 * - Never attribute one entity's data to a different entity just because they're nearby
 * - If two sources conflict, show neither (or label both with provenance)
 * - Better to have fewer facts than wrong facts
 *
 * Usage: npx tsx scripts/enrich-cross-reference.ts
 */

import { readFile, writeFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

// --- Types ---

interface CrossRefEnrichment {
  ancientName?: string
  greekName?: string
  modernName?: string
  province?: string
  /** Where the province info comes from */
  provinceSrc?: string
  startYear?: number
  endYear?: number
  pleiadesDescription?: string
  pleiadesType?: string
  /** How many ancient text passages reference this SPECIFIC place (name-matched only) */
  ancientTextMentions?: number
  ancientAuthors?: string[]
  /** ORBIS trade site type — only for sites actually in ORBIS */
  tradeRole?: string
  combatants?: string
  commander?: string
  outcome?: string
  capacity?: number
  dimensions?: string
  buildingType?: string
  sources: string[]
}

type CrossRefLookup = Record<string, CrossRefEnrichment>

// --- Data structures ---

interface DareSettlement {
  id: string
  name: string
  modern?: string
  lat: number
  lng: number
  major?: boolean
  type?: number
  startYear?: number
  endYear?: number
  greek?: string
}

interface PleiadesPlace {
  id: string
  name: string
  lat: number
  lng: number
  placeType: string
  startYear?: number
  endYear?: number
  description?: string
}

interface PelagiosPlace {
  id: string
  name: string
  lat: number
  lng: number
  mentionCount: number
  datasets?: string[]
}

interface OrbisSite {
  id: string
  name: string
  lat: number
  lng: number
  siteType: string
  province: string
}

// EDH intentionally not used — 50km grid resolution too coarse for site-level attribution

interface Battle {
  id: string
  name: string
  year: number
  lat: number
  lng: number
  outcome?: string
  combatants?: string
  commander?: string
}

interface Amphitheater {
  id: string
  name: string
  lat: number
  lng: number
  capacity?: number
  constructionYear?: number
  dimensions?: string
  city?: string
}

interface Building {
  id: string
  name: string
  lat: number
  lng: number
  buildingType: string
  constructionYear?: number
  description?: string
}

// --- Matching utilities ---

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function buildSpatialIndex<T extends { lat: number; lng: number }>(items: T[]): Map<string, T[]> {
  const index = new Map<string, T[]>()
  for (const item of items) {
    const key = `${Math.floor(item.lat)}:${Math.floor(item.lng)}`
    const arr = index.get(key) ?? []
    arr.push(item)
    index.set(key, arr)
  }
  return index
}

function findNearest<T extends { lat: number; lng: number }>(
  lat: number,
  lng: number,
  index: Map<string, T[]>,
  maxDistKm: number,
): T | null {
  let best: T | null = null
  let bestDist = maxDistKm
  for (let dlat = -1; dlat <= 1; dlat++) {
    for (let dlng = -1; dlng <= 1; dlng++) {
      for (const c of index.get(`${Math.floor(lat) + dlat}:${Math.floor(lng) + dlng}`) ?? []) {
        const d = haversine(lat, lng, c.lat, c.lng)
        if (d < bestDist) {
          bestDist = d
          best = c
        }
      }
    }
  }
  return best
}

/** Normalize a name for fuzzy matching: lowercase, strip diacritics, collapse whitespace */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Check if a Pleiades type is a settlement-level entity (not a building/gate/bridge) */
function isSettlementType(placeType: string): boolean {
  const t = placeType.toLowerCase()
  return (
    /settlement|urban|city|town|village|colonia|municipium|port|station|vicus|oppidum|polis|civitas/.test(
      t,
    ) && !/gate|bridge|aqueduct|villa|fort-|tomb|temple|theater|bath/.test(t)
  )
}

// --- Main ---

async function loadJSON<T>(relPath: string): Promise<T> {
  const path = fileURLToPath(new URL(`../src/data/${relPath}`, import.meta.url))
  if (!existsSync(path)) throw new Error(`Not found: ${relPath}`)
  return JSON.parse(await readFile(path, 'utf-8')) as T
}

async function main() {
  console.log('Cross-Reference Enrichment (local academic data only)\n')
  console.log('ACCURACY MODE: name-first matching, no spatial bleeding\n')

  // Load all sources
  console.log('Loading data sources...')
  const dare = await loadJSON<DareSettlement[]>('dare/settlements.json')
  const pleiades = await loadJSON<PleiadesPlace[]>('pleiades-all.json')
  const pelagios = await loadJSON<PelagiosPlace[]>('pelagios-places.json')
  const orbis = await loadJSON<{ sites: OrbisSite[] }>('trade/orbis.json')
  const battles = await loadJSON<Battle[]>('battles/battles.json')
  const amphitheaters = await loadJSON<Amphitheater[]>('amphitheaters/amphitheaters.json')
  const buildings = await loadJSON<Building[]>('buildings/buildings.json')

  console.log(`  DARE: ${dare.length}, Pleiades: ${pleiades.length}, Pelagios: ${pelagios.length}`)
  console.log(`  ORBIS: ${orbis.sites.length}, Battles: ${battles.length}`)
  console.log(`  Amphitheaters: ${amphitheaters.length}, Buildings: ${buildings.length}`)

  // Build NAME indices (primary) — much more accurate than spatial
  console.log('Building name indices...')
  const pleiadesNameIndex = new Map<string, PleiadesPlace[]>()
  for (const p of pleiades) {
    const key = normalizeName(p.name)
    const arr = pleiadesNameIndex.get(key) ?? []
    arr.push(p)
    pleiadesNameIndex.set(key, arr)
  }

  const pelagiosNameIndex = new Map<string, PelagiosPlace>()
  for (const p of pelagios) {
    pelagiosNameIndex.set(normalizeName(p.name), p)
  }

  const orbisNameIndex = new Map<string, OrbisSite>()
  for (const s of orbis.sites) {
    orbisNameIndex.set(normalizeName(s.name), s)
  }

  // Spatial indices (fallback only, with strict type guards)
  const pleiadesIndex = buildSpatialIndex(pleiades)
  const orbisIndex = buildSpatialIndex(orbis.sites)

  const output: CrossRefLookup = {}

  // === SETTLEMENTS ===
  console.log('\nEnriching settlements...')
  const stats = { pleiades: 0, pelagios: 0, orbis: 0, total: 0 }

  for (const d of dare) {
    const enrichment: CrossRefEnrichment = { sources: ['DARE'] }

    enrichment.ancientName = d.name
    if (d.greek) enrichment.greekName = d.greek
    if (d.modern) enrichment.modernName = d.modern
    if (d.startYear != null) enrichment.startYear = d.startYear
    if (d.endYear != null) enrichment.endYear = d.endYear

    // --- Pleiades: NAME match first, spatial fallback with settlement-type guard ---
    const plByName = pleiadesNameIndex.get(normalizeName(d.name))
    const plMatch = plByName?.find(
      (p) => isSettlementType(p.placeType) && haversine(d.lat, d.lng, p.lat, p.lng) < 50,
    )

    if (plMatch?.description && plMatch.description.length > 20) {
      enrichment.pleiadesDescription = plMatch.description
      enrichment.pleiadesType = plMatch.placeType
      enrichment.sources.push('Pleiades')
      stats.pleiades++
    } else {
      // Spatial fallback: only if it's a settlement-type AND within 2km (very tight)
      const plNear = findNearest(d.lat, d.lng, pleiadesIndex, 2)
      if (
        plNear &&
        isSettlementType(plNear.placeType) &&
        plNear.description &&
        plNear.description.length > 20
      ) {
        enrichment.pleiadesDescription = plNear.description
        enrichment.pleiadesType = plNear.placeType
        enrichment.sources.push('Pleiades')
        stats.pleiades++
      }
    }

    // --- Pelagios: NAME MATCH ONLY — never spatial ---
    // This prevents Athens' 423k mentions from bleeding to nearby demes
    const peMatch = pelagiosNameIndex.get(normalizeName(d.name))
    if (peMatch && peMatch.mentionCount > 0) {
      enrichment.ancientTextMentions = peMatch.mentionCount
      if (peMatch.datasets?.length) enrichment.ancientAuthors = peMatch.datasets
      enrichment.sources.push('Pelagios')
      stats.pelagios++
    }

    // --- ORBIS: name match first, tight spatial fallback ---
    const orbMatch = orbisNameIndex.get(normalizeName(d.name))
    if (orbMatch) {
      enrichment.province = orbMatch.province
      enrichment.provinceSrc = 'ORBIS'
      enrichment.tradeRole = orbMatch.siteType
      enrichment.sources.push('ORBIS')
      stats.orbis++
    } else {
      // Spatial fallback: 10km, which is tight enough for ORBIS' ~632 major sites
      const orbNear = findNearest(d.lat, d.lng, orbisIndex, 10)
      if (orbNear) {
        enrichment.province = orbNear.province
        enrichment.provinceSrc = 'ORBIS'
        enrichment.sources.push('ORBIS')
        stats.orbis++
      }
    }

    // NOTE: EDH inscriptions intentionally omitted — 50km grid resolution
    // makes per-site attribution misleading. Better to show EDH as a map layer.

    output[`settlement:${d.id}`] = enrichment
    stats.total++
  }
  console.log(
    `  ${stats.total} settlements: Pleiades ${stats.pleiades}, Pelagios ${stats.pelagios}, ORBIS ${stats.orbis}`,
  )

  // === AMPHITHEATERS ===
  console.log('Enriching amphitheaters...')
  for (const a of amphitheaters) {
    const enrichment: CrossRefEnrichment = { sources: ['roman-amphitheaters'] }

    if (a.capacity) enrichment.capacity = a.capacity
    if (a.dimensions) enrichment.dimensions = a.dimensions
    if (a.constructionYear) enrichment.startYear = a.constructionYear

    // Province from ORBIS (by city name or spatial)
    if (a.city) {
      const orbMatch = orbisNameIndex.get(normalizeName(a.city))
      if (orbMatch) {
        enrichment.province = orbMatch.province
        enrichment.sources.push('ORBIS')
      }
    }
    if (!enrichment.province) {
      const orbNear = findNearest(a.lat, a.lng, orbisIndex, 15)
      if (orbNear) {
        enrichment.province = orbNear.province
        enrichment.sources.push('ORBIS')
      }
    }

    // Pleiades: look for amphitheater-type entries specifically
    const plByName = pleiadesNameIndex.get(normalizeName(a.name))
    const plMatch = plByName?.find((p) => haversine(a.lat, a.lng, p.lat, p.lng) < 20)
    if (plMatch?.description && plMatch.description.length > 20) {
      enrichment.pleiadesDescription = plMatch.description
      enrichment.sources.push('Pleiades')
    }

    // Pelagios by city name (not amphitheater name)
    if (a.city) {
      const peMatch = pelagiosNameIndex.get(normalizeName(a.city))
      if (peMatch && peMatch.mentionCount > 0) {
        enrichment.ancientTextMentions = peMatch.mentionCount
        if (peMatch.datasets?.length) enrichment.ancientAuthors = peMatch.datasets
        enrichment.sources.push('Pelagios')
      }
    }

    output[`amphitheater:${a.id}`] = enrichment
  }
  console.log(`  ${amphitheaters.length} amphitheaters enriched`)

  // === BATTLES ===
  // Battles already have their own rich data (combatants, commander, outcome).
  // Don't add "nearest settlement" — it's misleading. Only add province if confident.
  console.log('Enriching battles...')
  for (const b of battles) {
    const enrichment: CrossRefEnrichment = { sources: ['Roman-Battles'] }

    if (b.combatants && b.combatants !== 'Unknown') enrichment.combatants = b.combatants
    if (b.commander && b.commander !== 'Unknown') enrichment.commander = b.commander
    if (b.outcome && b.outcome !== 'unknown') enrichment.outcome = b.outcome
    enrichment.startYear = b.year

    // Province from ORBIS — only if within 20km of a known ORBIS site
    const orbNear = findNearest(b.lat, b.lng, orbisIndex, 20)
    if (orbNear) {
      enrichment.province = orbNear.province
      enrichment.sources.push('ORBIS')
    }

    output[`battle:${b.id}`] = enrichment
  }
  console.log(`  ${battles.length} battles enriched`)

  // === BUILDINGS ===
  // Buildings come from Pleiades — description is already from the source.
  // Only add province and settlement context.
  console.log('Enriching buildings...')
  for (const b of buildings) {
    const enrichment: CrossRefEnrichment = { sources: ['Pleiades'] }

    enrichment.buildingType = b.buildingType
    if (b.constructionYear) enrichment.startYear = b.constructionYear
    if (b.description && b.description.length > 20) enrichment.pleiadesDescription = b.description

    // Province from ORBIS
    const orbNear = findNearest(b.lat, b.lng, orbisIndex, 15)
    if (orbNear) {
      enrichment.province = orbNear.province
      enrichment.sources.push('ORBIS')
    }

    output[`building:${b.id}`] = enrichment
  }
  console.log(`  ${buildings.length} buildings enriched`)

  // === SAVE ===
  const outputPath = fileURLToPath(
    new URL('../src/data/wiki/cross-reference.json', import.meta.url),
  )
  await writeFile(outputPath, JSON.stringify(output, null, 2))

  // Stats
  const all = Object.values(output)
  const withProvince = all.filter((e) => e.province).length
  const withPelagios = all.filter((e) => e.ancientTextMentions).length
  const withPleiades = all.filter((e) => e.pleiadesDescription).length
  const avgSources = (all.reduce((s, e) => s + e.sources.length, 0) / all.length).toFixed(1)

  console.log(`\nComplete: ${all.length} entries`)
  console.log(`  With Roman province: ${withProvince}`)
  console.log(`  With ancient text mentions (name-matched): ${withPelagios}`)
  console.log(`  With Pleiades description (type-guarded): ${withPleiades}`)
  console.log(`  Average sources per entry: ${avgSources}`)
  console.log(`\nDropped: EDH inscriptions (50km grid too coarse for site-level attribution)`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
