/**
 * Appends Byzantine (Eastern Roman) Empire territory snapshots (500–1453) to the
 * existing territories.json WITHOUT touching the fine-grained classical data.
 *
 * Source: aourednik/historical-basemaps (same as generate-territories.ts).
 * Idempotent: strips any prior year > 476 entries before re-adding.
 *
 * Usage: npx tsx scripts/add-byzantine-territories.ts
 */

const BASE_URL = 'https://raw.githubusercontent.com/aourednik/historical-basemaps/master/geojson'
const BYZANTINE_YEARS = [500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400]

interface Geometry {
  type: string
  coordinates: unknown[]
}
interface Feature {
  type: 'Feature'
  properties: Record<string, unknown>
  geometry: Geometry
}
interface FeatureCollection {
  type: 'FeatureCollection'
  features: Feature[]
}
interface TerritoryEntry {
  id: string
  year: number
  controlledBy: string
  status: string
  label: string
  boundaries: { type: 'Feature'; properties: { name: string }; geometry: Geometry }
}

const isByzantine = (n: string) => n === 'Eastern Roman Empire' || n === 'Byzantine Empire'

// Round coordinates to ~1 km (2 decimals) — invisible at Mediterranean scale,
// but the raw historical-basemaps geometries are far higher-res than we need.
type Coord = number | Coord[]
function roundCoords(c: Coord): Coord {
  if (typeof c[0] === 'number') {
    return [Math.round((c[0] as number) * 100) / 100, Math.round((c[1] as number) * 100) / 100]
  }
  return (c as Coord[]).map(roundCoords)
}
function roundGeometry(g: Geometry): Geometry {
  return { ...g, coordinates: roundCoords(g.coordinates as Coord[]) as unknown[] }
}

async function fetchGeoJSON(filename: string): Promise<FeatureCollection> {
  const res = await fetch(`${BASE_URL}/${filename}`)
  if (!res.ok) throw new Error(`Failed to fetch ${filename}: ${res.status}`)
  return res.json() as Promise<FeatureCollection>
}

function mergeGeometries(features: Feature[]): Geometry {
  const polys: unknown[] = []
  for (const f of features) {
    if (f.geometry.type === 'Polygon') polys.push(f.geometry.coordinates)
    else if (f.geometry.type === 'MultiPolygon')
      for (const p of f.geometry.coordinates as unknown[]) polys.push(p)
  }
  return { type: 'MultiPolygon', coordinates: polys }
}

async function main() {
  const { readFile, writeFile } = await import('fs/promises')
  const { fileURLToPath } = await import('url')
  const outPath = fileURLToPath(
    new URL('../src/data/territories/territories.json', import.meta.url),
  )

  const existing: TerritoryEntry[] = JSON.parse(await readFile(outPath, 'utf-8'))
  // Keep only the classical data (≤ 476); drop any prior Byzantine run.
  const results: TerritoryEntry[] = existing.filter((t) => t.year <= 476)
  console.log(`Loaded ${existing.length} snapshots, kept ${results.length} classical (≤476).`)

  for (const year of BYZANTINE_YEARS) {
    const gj = await fetchGeoJSON(`world_${year}.geojson`)
    const matches = gj.features.filter((f) => {
      const name = (f.properties?.NAME as string) || (f.properties?.name as string) || ''
      return isByzantine(name)
    })
    if (matches.length === 0) {
      console.warn(`  ⚠ No Byzantine feature for ${year}`)
      continue
    }
    const raw = matches.length === 1 ? matches[0].geometry : mergeGeometries(matches)
    const geometry = roundGeometry(raw)
    const label = `${year < 800 ? 'Eastern Roman Empire' : 'Byzantine Empire'} — ${year} AD`
    results.push({
      id: 'eastern-empire',
      year,
      controlledBy: 'constantinople',
      status: 'controlled',
      label,
      boundaries: { type: 'Feature', properties: { name: label }, geometry },
    })
    const nPoly = geometry.type === 'MultiPolygon' ? geometry.coordinates.length : 1
    console.log(`  ✓ ${year}: ${nPoly} polygon(s)`)
  }

  // 1453: Fall of Constantinople — reuse the 1400 extent, marked lost.
  const byz1400 = results.find((r) => r.id === 'eastern-empire' && r.year === 1400)
  if (byz1400) {
    results.push({
      ...byz1400,
      year: 1453,
      status: 'lost',
      label: 'Fall of Constantinople — 1453 AD',
      boundaries: { ...byz1400.boundaries, properties: { name: 'Byzantine Empire 1453 (fallen)' } },
    })
    console.log('  ✓ 1453: Fall of Constantinople')
  }

  results.sort((a, b) => a.year - b.year || a.id.localeCompare(b.id))
  const json = JSON.stringify(results, null, 2)
  await writeFile(outPath, json + '\n')
  console.log(`\n✓ Wrote ${results.length} snapshots (${(json.length / 1024).toFixed(0)} KB)`)
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
