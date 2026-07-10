/**
 * Build a unified entities.json from all point-type data sources.
 * Each entity has: id, type, subtype, name, lat, lng, qid, startYear, endYear, source, props
 *
 * Usage: npx tsx scripts/build-unified-entities.ts
 */
import { readFile, writeFile } from 'fs/promises'

interface UnifiedEntity {
  id: string
  type: string
  subtype?: string
  category?: string
  name: string
  lat: number
  lng: number
  qid?: string
  startYear?: number
  endYear?: number
  source: string
  props?: Record<string, unknown>
}

const CATEGORY_MAP: Record<string, string> = {
  amphitheater: 'entertainment',
  amphitheatre: 'entertainment',
  theater: 'entertainment',
  theatre: 'entertainment',
  'theater-2': 'entertainment',
  odeon: 'entertainment',
  stadion: 'entertainment',
  circus: 'entertainment',
  battle: 'military',
  fort: 'military',
  'fort-2': 'military',
  fortlet: 'military',
  hillfort: 'military',
  'fortified-settlement': 'military',
  'military-installation-or-camp-temporary': 'military',
  barracks: 'military',
  'military-base': 'military',
  wall: 'military',
  'wall-2': 'military',
  'defensive-wall': 'military',
  'city-wall': 'military',
  'tower-defensive': 'military',
  'tower-wall': 'military',
  'tower-gate': 'military',
  'frontier-system-limes': 'military',
  building: 'infrastructure',
  bath: 'infrastructure',
  aqueduct: 'infrastructure',
  bridge: 'infrastructure',
  dam: 'infrastructure',
  canal: 'infrastructure',
  tunnel: 'infrastructure',
  fountain: 'infrastructure',
  cistern: 'infrastructure',
  reservoir: 'infrastructure',
  sewer: 'infrastructure',
  lighthouse: 'infrastructure',
  port: 'trade',
  harbor: 'trade',
  anchorage: 'trade',
  mine: 'production',
  quarry: 'production',
  press: 'production',
  production: 'production',
  metalworking: 'production',
  ceramicproduction: 'production',
  shipwreck: 'maritime',
  'religious-site': 'religion',
  temple: 'religion',
  'temple-2': 'religion',
  sanctuary: 'religion',
  shrine: 'religion',
  church: 'religion',
  'church-2': 'religion',
  monastery: 'religion',
  abbey: 'religion',
  'abbey-church': 'religion',
  mosque: 'religion',
  synagogue: 'religion',
  basilica: 'religion',
  priory: 'religion',
  villa: 'habitation',
  settlement: 'habitation',
  'settlement-modern': 'habitation',
  townhouse: 'habitation',
  estate: 'habitation',
  farm: 'habitation',
  'city-block': 'habitation',
  cemetery: 'funerary',
  tomb: 'funerary',
  tumulus: 'funerary',
  cenotaph: 'funerary',
  pyramid: 'funerary',
  river: 'geography',
  mountain: 'geography',
  island: 'geography',
  lake: 'geography',
  cape: 'geography',
  peninsula: 'geography',
  valley: 'geography',
  plain: 'geography',
  plateau: 'geography',
  hill: 'geography',
  coast: 'geography',
  bay: 'geography',
  strait: 'geography',
  gorge: 'geography',
  volcano: 'geography',
  delta: 'geography',
  oasis: 'geography',
  spring: 'geography',
  water: 'geography',
  'water-open': 'geography',
  'water-inland': 'geography',
  well: 'geography',
  'marsh-wetland': 'geography',
  lagoon: 'geography',
  estuary: 'geography',
  forest: 'geography',
  desert: 'geography',
  region: 'administrative',
  province: 'administrative',
  'province-2': 'administrative',
  district: 'administrative',
  state: 'administrative',
  'diocese-roman': 'administrative',
  'nome-gr': 'administrative',
  'nome-egyptian': 'administrative',
  tribus: 'administrative',
  'deme-attic': 'administrative',
  pagus: 'administrative',
  satrapy: 'administrative',
  polis: 'administrative',
  road: 'transport',
  station: 'transport',
  pass: 'transport',
  causeway: 'transport',
  'city-gate': 'transport',
  gateway: 'transport',
  postern: 'transport',
  monument: 'monument',
  arch: 'monument',
  stoa: 'monument',
  agora: 'monument',
  forum: 'monument',
  plaza: 'monument',
  'palace-complex': 'monument',
  palace: 'monument',
  garden: 'monument',
  'garden-hortus': 'monument',
  acropolis: 'monument',
  citadel: 'monument',
  'archaeological-site': 'archaeological',
  findspot: 'archaeological',
  'cultural-landscape': 'archaeological',
  earthwork: 'archaeological',
  earthworks: 'archaeological',
  'crop-marks': 'archaeological',
  nuraghe: 'archaeological',
  tell: 'archaeological',
  ruin: 'archaeological',
  cave: 'archaeological',
}

const PLEIADES_REGISTRY_PATH = 'src/data/registry/pleiades-wikidata.json'

async function loadJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf-8'))
}

async function main() {
  const entities: UnifiedEntity[] = []

  // Load QID registries for lookup
  let pleiadesQids: Record<string, string> = {}
  try {
    pleiadesQids = await loadJson(PLEIADES_REGISTRY_PATH)
  } catch {
    /* ok */
  }

  // 1. Amphitheaters
  const amphs = await loadJson<
    Array<{
      id: string
      name: string
      lat: number
      lng: number
      capacity?: number
      constructionYear?: number
      dimensions?: string
      city?: string
      source?: string
      pleiadesId?: string
    }>
  >('src/data/amphitheaters/amphitheaters.json')

  for (const a of amphs) {
    entities.push({
      id: `amphitheater:${a.id}`,
      type: 'amphitheater',
      name: a.name,
      lat: a.lat,
      lng: a.lng,
      qid: a.pleiadesId ? pleiadesQids[a.pleiadesId] : undefined,
      startYear: a.constructionYear,
      source: a.source ?? 'compiled',
      props: {
        ...(a.capacity && { capacity: a.capacity }),
        ...(a.dimensions && { dimensions: a.dimensions }),
        ...(a.city && { city: a.city }),
      },
    })
  }
  console.log(`Amphitheaters: ${amphs.length}`)

  // 2. Battles
  const battles = await loadJson<
    Array<{
      id: string
      name: string
      year: number
      lat: number
      lng: number
      outcome?: string
      combatants?: string
      commander?: string
      description?: string
      source?: string
      qid?: string
    }>
  >('src/data/battles/battles.json')

  for (const b of battles) {
    entities.push({
      id: `battle:${b.id}`,
      type: 'battle',
      name: b.name,
      lat: b.lat,
      lng: b.lng,
      qid: b.qid,
      startYear: b.year,
      endYear: b.year,
      source: b.source ?? 'compiled',
      props: {
        ...(b.outcome && { outcome: b.outcome }),
        ...(b.combatants && { combatants: b.combatants }),
        ...(b.commander && { commander: b.commander }),
        ...(b.description && { description: b.description }),
      },
    })
  }
  console.log(`Battles: ${battles.length}`)

  // 2b. Wikidata world battles — global coverage for full-timeline mode.
  // The curated set wins on overlap (it carries outcome/combatants/commander).
  const wdBattles = await loadJson<
    Array<{
      id: string
      name: string
      year: number
      lat: number
      lng: number
      description?: string
      qid?: string
      partOf?: string
    }>
  >('src/data/battles/wikidata-battles.json')

  const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const curatedYears = new Map<string, number[]>()
  for (const b of battles) {
    const k = normName(b.name)
    if (!curatedYears.has(k)) curatedYears.set(k, [])
    curatedYears.get(k)!.push(b.year)
  }
  const seenWdIds = new Set<string>()
  let wdAdded = 0
  let wdDupes = 0
  let wdOutOfWindow = 0
  for (const b of wdBattles) {
    // Full-timeline window (matches FULL_MIN/FULL_MAX in the timeline store)
    if (b.year < -3700 || b.year > 1975) {
      wdOutOfWindow++
      continue
    }
    const years = curatedYears.get(normName(b.name))
    if (years?.some((y) => Math.abs(y - b.year) <= 25)) {
      wdDupes++
      continue
    }
    if (seenWdIds.has(b.id)) continue
    seenWdIds.add(b.id)
    entities.push({
      id: `battle:${b.id}`,
      type: 'battle',
      name: b.name,
      lat: b.lat,
      lng: b.lng,
      qid: b.qid,
      startYear: b.year,
      endYear: b.year,
      source: 'wikidata',
      props: {
        outcome: 'unknown',
        ...(b.partOf && { partOf: b.partOf }),
        ...(b.description && { description: b.description }),
      },
    })
    wdAdded++
  }
  console.log(
    `Wikidata battles: ${wdAdded} added (${wdDupes} curated overlaps skipped, ${wdOutOfWindow} outside -3700..1975)`,
  )

  // 3. Buildings
  const buildings = await loadJson<
    Array<{
      id: string
      name: string
      lat: number
      lng: number
      buildingType?: string
      constructionYear?: number
      builder?: string
      description?: string
      source?: string
      qid?: string
    }>
  >('src/data/buildings/buildings.json')

  for (const b of buildings) {
    entities.push({
      id: `building:${b.id}`,
      type: 'building',
      subtype: b.buildingType,
      name: b.name,
      lat: b.lat,
      lng: b.lng,
      qid: b.qid,
      startYear: b.constructionYear,
      source: b.source ?? 'Pleiades',
      props: {
        ...(b.builder && { builder: b.builder }),
        ...(b.description && { description: b.description }),
      },
    })
  }
  console.log(`Buildings: ${buildings.length}`)

  // 4. Ports
  const ports = await loadJson<
    Array<{
      id: string
      name: string
      lat: number
      lng: number
      portType: string
      description?: string
      startYear?: number
      endYear?: number
    }>
  >('src/data/ancient-ports.json')

  for (const p of ports) {
    entities.push({
      id: `port:${p.id}`,
      type: 'port',
      subtype: p.portType,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      startYear: p.startYear,
      endYear: p.endYear,
      source: 'ancient-ports',
      props: {
        ...(p.description && { description: p.description }),
      },
    })
  }
  console.log(`Ports: ${ports.length}`)

  // 5. Mines
  const mines = await loadJson<
    Array<{
      id: string
      name: string
      lat: number
      lng: number
      resourceType?: string
      siteType?: string
      startYear?: number
      endYear?: number
      description?: string
      source?: string
    }>
  >('src/data/mines/mines.json')

  for (const m of mines) {
    entities.push({
      id: `mine:${m.id}`,
      type: 'mine',
      subtype: m.resourceType,
      name: m.name,
      lat: m.lat,
      lng: m.lng,
      startYear: m.startYear,
      endYear: m.endYear,
      source: m.source ?? 'compiled',
      props: {
        ...(m.siteType && { siteType: m.siteType }),
        ...(m.description && { description: m.description }),
      },
    })
  }
  console.log(`Mines: ${mines.length}`)

  // 6. Shipwrecks
  const wrecks = await loadJson<
    Array<{
      id: string
      name: string
      lat: number
      lng: number
      startYear?: number
      endYear?: number
      cargoType?: string
      depth?: number
      description?: string
      source?: string
    }>
  >('src/data/shipwrecks/shipwrecks.json')

  for (const w of wrecks) {
    entities.push({
      id: `shipwreck:${w.id}`,
      type: 'shipwreck',
      subtype: w.cargoType,
      name: w.name,
      lat: w.lat,
      lng: w.lng,
      startYear: w.startYear,
      endYear: w.endYear,
      source: w.source ?? 'compiled',
      props: {
        ...(w.depth && { depth: w.depth }),
        ...(w.description && { description: w.description }),
      },
    })
  }
  console.log(`Shipwrecks: ${wrecks.length}`)

  // 7. Religious sites
  const religion = await loadJson<
    Array<{
      id: string
      name: string
      lat: number
      lng: number
      religion?: string
      siteType?: string
      deity?: string
      startYear?: number
      endYear?: number
      description?: string
      source?: string
    }>
  >('src/data/religion/religion.json')

  for (const r of religion) {
    entities.push({
      id: `religion:${r.id}`,
      type: 'religious-site',
      subtype: r.siteType,
      name: r.name,
      lat: r.lat,
      lng: r.lng,
      startYear: r.startYear,
      endYear: r.endYear,
      source: r.source ?? 'compiled',
      props: {
        ...(r.religion && { religion: r.religion }),
        ...(r.deity && { deity: r.deity }),
        ...(r.description && { description: r.description }),
      },
    })
  }
  console.log(`Religious sites: ${religion.length}`)

  // 8. Aqueducts
  const aqueducts = await loadJson<
    Array<{
      id: string
      name: string
      lat: number
      lng: number
      constructionYear?: number
      length?: number
      builder?: string
      cityServed?: string
      description?: string
      source?: string
    }>
  >('src/data/aqueducts/aqueducts.json')

  for (const a of aqueducts) {
    entities.push({
      id: `aqueduct:${a.id}`,
      type: 'aqueduct',
      name: a.name,
      lat: a.lat,
      lng: a.lng,
      startYear: a.constructionYear,
      source: a.source ?? 'compiled',
      props: {
        ...(a.length && { length: a.length }),
        ...(a.builder && { builder: a.builder }),
        ...(a.cityServed && { cityServed: a.cityServed }),
        ...(a.description && { description: a.description }),
      },
    })
  }
  console.log(`Aqueducts: ${aqueducts.length}`)

  // 9. Presses
  const presses = await loadJson<
    Array<{
      id: string
      name: string
      lat: number
      lng: number
      pressType?: string
      startYear?: number
      endYear?: number
      description?: string
      source?: string
    }>
  >('src/data/presses/presses.json')

  for (const p of presses) {
    entities.push({
      id: `press:${p.id}`,
      type: 'press',
      subtype: p.pressType,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      startYear: p.startYear,
      endYear: p.endYear,
      source: p.source ?? 'compiled',
      props: {
        ...(p.description && { description: p.description }),
      },
    })
  }
  console.log(`Presses: ${presses.length}`)

  // 10. New Pleiades entities (from downloaded dump)
  try {
    const pleiadesNew = await loadJson<
      Array<{
        pid: string
        title: string
        lat: number
        lng: number
        types: string[]
        description?: string
        names?: Array<{ name: string; language?: string }>
        qid?: string
      }>
    >('src/data/downloads/pleiades-new-entities.json')

    const typeMap: Record<string, string> = {
      villa: 'villa',
      river: 'river',
      bridge: 'bridge',
      sanctuary: 'sanctuary',
      'temple-2': 'temple',
      mountain: 'mountain',
      cemetery: 'cemetery',
      aqueduct: 'aqueduct',
      tomb: 'tomb',
      island: 'island',
      'church-2': 'church',
      'archaeological-site': 'archaeological-site',
      'mine-2': 'mine',
      fort: 'fort',
      'fort-2': 'fort',
      settlement: 'settlement',
      road: 'road',
      region: 'region',
      label: 'label',
      monument: 'monument',
      bath: 'bath',
      station: 'station',
      production: 'production',
      'water-open': 'water',
      'water-inland': 'water',
      well: 'well',
      wall: 'wall',
      circus: 'circus',
      dam: 'dam',
      canal: 'canal',
      'theater-2': 'theater',
    }

    for (const p of pleiadesNew) {
      const primaryType = p.types[0] || 'unknown'
      const mappedType = typeMap[primaryType] || primaryType
      // Skip types that are just labels/people/unknown
      if (
        ['label', 'people', 'unlocated', 'unlabeled', 'unknown', 'numbered feature'].includes(
          primaryType,
        )
      )
        continue

      entities.push({
        id: `pleiades:${p.pid}`,
        type: mappedType,
        name: p.title,
        lat: p.lat,
        lng: p.lng,
        qid: p.qid || pleiadesQids[p.pid],
        source: 'Pleiades',
        props: {
          ...(p.description && { description: p.description }),
          ...(p.names &&
            p.names.length > 0 && {
              ancientName: p.names[0].name,
            }),
        },
      })
    }
    console.log(`Pleiades new entities: ${pleiadesNew.length} (after filtering)`)
  } catch {
    console.log('Pleiades new entities: skipped (file not found)')
  }

  // Assign categories and clean up
  for (const e of entities) {
    e.category = CATEGORY_MAP[e.type] ?? 'other'
    if (e.props && Object.keys(e.props).length === 0) delete e.props
    if (e.startYear === 0) delete e.startYear
    if (e.endYear === 0) delete e.endYear
  }

  // Stats
  const byType: Record<string, number> = {}
  let withQid = 0
  for (const e of entities) {
    byType[e.type] = (byType[e.type] || 0) + 1
    if (e.qid) withQid++
  }

  console.log(`\n=== Unified Entities ===`)
  console.log(`Total: ${entities.length}`)
  console.log(`With QID: ${withQid}`)
  console.log(`\nBy type:`)
  Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  ${count.toString().padStart(6)} ${type}`)
    })

  console.log(`\nTotal entities: ${entities.length}`)

  // Emit per-type chunks for lazy loading (migrated layers load only their type)
  const CHUNKED_TYPES = [
    'battle',
    'amphitheater',
    'building',
    'religious-site',
    'shipwreck',
    'mine',
    'aqueduct',
    'press',
    'port',
  ]
  const chunkDir = 'src/data/unified'
  await import('fs/promises').then((fs) => fs.mkdir(chunkDir, { recursive: true }))
  for (const type of CHUNKED_TYPES) {
    const chunk = entities.filter((e) => e.type === type)
    const filename = `${chunkDir}/${type}.json`
    await writeFile(filename, JSON.stringify(chunk) + '\n')
    console.log(`  ${chunk.length.toString().padStart(6)} → ${filename}`)
  }

  // Multi-type chunks for Discovery layers
  const DISCOVERY_CHUNKS: Record<string, string[]> = {
    villa: ['villa', 'estate', 'townhouse', 'farm'],
    temple: ['temple', 'sanctuary', 'shrine'],
    bridge: ['bridge'],
    tomb: ['tomb', 'cemetery', 'tumulus', 'cenotaph', 'pyramid'],
  }
  for (const [name, types] of Object.entries(DISCOVERY_CHUNKS)) {
    const typeSet = new Set(types)
    const chunk = entities.filter((e) => typeSet.has(e.type))
    const filename = `${chunkDir}/discovery-${name}.json`
    await writeFile(filename, JSON.stringify(chunk) + '\n')
    console.log(`  ${chunk.length.toString().padStart(6)} → ${filename}`)
  }
}

main().catch(console.error)
