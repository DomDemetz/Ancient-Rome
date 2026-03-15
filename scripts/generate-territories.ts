/**
 * One-time script to generate high-quality territory boundaries from
 * aourednik/historical-basemaps GeoJSON data.
 *
 * Usage: npx tsx scripts/generate-territories.ts
 */

const BASE_URL = 'https://raw.githubusercontent.com/aourednik/historical-basemaps/master/geojson'

interface YearConfig {
  targetYear: number
  sourceFile: string
  filter: (name: string) => boolean
  id: string
  controlledBy: string
  status: 'controlled' | 'lost'
  label: string
  merge?: boolean // merge multiple matching features into one MultiPolygon
}

const YEAR_CONFIGS: YearConfig[] = [
  {
    targetYear: -500,
    sourceFile: 'world_bc500.geojson',
    filter: (n) => n === 'Rome',
    id: 'rome',
    controlledBy: 'roman-kingdom',
    status: 'controlled',
    label: 'Rome — 500 BC',
  },
  {
    targetYear: -300,
    sourceFile: 'world_bc300.geojson',
    filter: (n) => n === 'Roman Republic',
    id: 'rome',
    controlledBy: 'roman-senate',
    status: 'controlled',
    label: 'Roman Republic — 300 BC',
  },
  {
    targetYear: -200,
    sourceFile: 'world_bc200.geojson',
    filter: (n) => n === 'Rome',
    id: 'rome',
    controlledBy: 'roman-senate',
    status: 'controlled',
    label: 'Roman Republic — 200 BC',
  },
  {
    targetYear: -100,
    sourceFile: 'world_bc100.geojson',
    filter: (n) => n === 'Roman Republic',
    id: 'rome',
    controlledBy: 'roman-senate',
    status: 'controlled',
    label: 'Roman Republic — 100 BC',
    merge: true,
  },
  {
    targetYear: -1,
    sourceFile: 'world_bc1.geojson',
    filter: (n) => n === 'Roman Empire',
    id: 'rome',
    controlledBy: 'augustus',
    status: 'controlled',
    label: 'Roman Empire — 1 BC',
  },
  {
    targetYear: 100,
    sourceFile: 'world_100.geojson',
    filter: (n) => n === 'Roman Empire',
    id: 'rome',
    controlledBy: 'trajan',
    status: 'controlled',
    label: 'Roman Empire — 100 AD',
  },
  {
    targetYear: 200,
    sourceFile: 'world_200.geojson',
    filter: (n) => n === 'Roman Empire',
    id: 'rome',
    controlledBy: 'roman-emperor',
    status: 'controlled',
    label: 'Roman Empire — 200 AD',
  },
  // 300 AD: Tetrarchy — merge all 4 parts
  {
    targetYear: 300,
    sourceFile: 'world_300.geojson',
    filter: (n) => n.includes('Rome') || n.includes('Roman'),
    id: 'rome',
    controlledBy: 'tetrarchy',
    status: 'controlled',
    label: 'Roman Empire (Tetrarchy) — 300 AD',
    merge: true,
  },
]

// 400 AD has Western + Eastern as separate entities
const YEAR_400_CONFIGS: YearConfig[] = [
  {
    targetYear: 400,
    sourceFile: 'world_400.geojson',
    filter: (n) => n === 'Western Roman Empire',
    id: 'rome',
    controlledBy: 'roman-emperor',
    status: 'controlled',
    label: 'Western Roman Empire — 400 AD',
  },
  {
    targetYear: 400,
    sourceFile: 'world_400.geojson',
    filter: (n) => n === 'Eastern Roman Empire',
    id: 'eastern-empire',
    controlledBy: 'constantinople',
    status: 'controlled',
    label: 'Eastern Roman Empire — 400 AD',
  },
]

interface GeoJSONFeature {
  type: 'Feature'
  properties: Record<string, unknown>
  geometry: {
    type: string
    coordinates: unknown[]
  }
}

interface GeoJSONCollection {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
}

interface TerritoryEntry {
  id: string
  year: number
  controlledBy: string
  status: string
  label: string
  boundaries: {
    type: 'Feature'
    properties: { name: string }
    geometry: {
      type: string
      coordinates: unknown[]
    }
  }
}

async function fetchGeoJSON(filename: string): Promise<GeoJSONCollection> {
  const url = `${BASE_URL}/${filename}`
  console.log(`  Fetching ${url}...`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  return res.json() as Promise<GeoJSONCollection>
}

function mergeFeatures(features: GeoJSONFeature[]): GeoJSONFeature {
  // Collect all polygon coordinates into a single MultiPolygon
  const allPolygons: unknown[] = []

  for (const f of features) {
    if (f.geometry.type === 'Polygon') {
      allPolygons.push(f.geometry.coordinates)
    } else if (f.geometry.type === 'MultiPolygon') {
      for (const poly of f.geometry.coordinates) {
        allPolygons.push(poly)
      }
    }
  }

  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'MultiPolygon',
      coordinates: allPolygons,
    },
  }
}

function countPoints(geometry: { type: string; coordinates: unknown[] }): number {
  if (geometry.type === 'Polygon') {
    return (geometry.coordinates as number[][][]).reduce((sum, ring) => sum + ring.length, 0)
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates as number[][][][]).reduce(
      (sum, poly) => sum + poly.reduce((s, ring) => s + ring.length, 0),
      0,
    )
  }
  return 0
}

function countPolygons(geometry: { type: string; coordinates: unknown[] }): number {
  if (geometry.type === 'Polygon') return 1
  if (geometry.type === 'MultiPolygon') return (geometry.coordinates as unknown[][]).length
  return 0
}

async function processConfig(config: YearConfig): Promise<TerritoryEntry | null> {
  const geojson = await fetchGeoJSON(config.sourceFile)
  const matches = geojson.features.filter((f) => {
    const name = (f.properties?.NAME as string) || (f.properties?.name as string) || ''
    return config.filter(name)
  })

  if (matches.length === 0) {
    console.warn(`  ⚠ No matches for year ${config.targetYear} in ${config.sourceFile}`)
    return null
  }

  let feature: GeoJSONFeature
  if (matches.length === 1 && !config.merge) {
    feature = matches[0]
  } else {
    feature = mergeFeatures(matches)
  }

  const points = countPoints(feature.geometry)
  const polys = countPolygons(feature.geometry)
  console.log(
    `  ✓ Year ${config.targetYear}: ${matches.length} feature(s) → ${polys} polygon(s), ${points} points`,
  )

  return {
    id: config.id,
    year: config.targetYear,
    controlledBy: config.controlledBy,
    status: config.status,
    label: config.label,
    boundaries: {
      type: 'Feature',
      properties: { name: config.label },
      geometry: feature.geometry,
    },
  }
}

async function main() {
  console.log('Generating territory boundaries from historical-basemaps...\n')

  const results: TerritoryEntry[] = []

  // Process standard configs
  for (const config of YEAR_CONFIGS) {
    const result = await processConfig(config)
    if (result) results.push(result)
  }

  // Process 400 AD (separate Western/Eastern)
  for (const config of YEAR_400_CONFIGS) {
    const result = await processConfig(config)
    if (result) results.push(result)
  }

  // Add 476 AD: Eastern survives, Western falls
  const eastern400 = results.find((r) => r.id === 'eastern-empire' && r.year === 400)
  const western400 = results.find((r) => r.id === 'rome' && r.year === 400)

  if (western400) {
    results.push({
      ...western400,
      year: 476,
      status: 'lost',
      controlledBy: 'roman-senate',
      label: 'Fall of the Western Roman Empire — 476 AD',
      boundaries: {
        ...western400.boundaries,
        properties: { name: 'Western Roman Empire 476 AD (fallen)' },
      },
    })
  }

  if (eastern400) {
    results.push({
      ...eastern400,
      year: 476,
      controlledBy: 'constantinople',
      label: 'Eastern Roman Empire — 476 AD',
      boundaries: {
        ...eastern400.boundaries,
        properties: { name: 'Eastern Roman Empire 476 AD' },
      },
    })
  }

  // Sort by year, then by id
  results.sort((a, b) => a.year - b.year || a.id.localeCompare(b.id))

  const outPath = new URL('../src/data/territories/territories.json', import.meta.url)
  const json = JSON.stringify(results, null, 2)
  const { writeFile } = await import('fs/promises')
  const { fileURLToPath } = await import('url')
  await writeFile(fileURLToPath(outPath), json + '\n')

  console.log(`\n✓ Wrote ${results.length} territory snapshots to territories.json`)
  console.log(`  File size: ${(json.length / 1024).toFixed(0)} KB`)
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
