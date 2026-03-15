/**
 * Generate limes (frontier lines) from DARE fort chains.
 * Connects type 17 (legionary fortress) and type 18 (fort) settlements
 * into LineString segments along known frontier corridors.
 *
 * Usage: npx tsx scripts/generate-limes.ts
 */

import { readFile, writeFile } from 'fs/promises'
import { fileURLToPath } from 'url'

interface Settlement {
  id: string
  name: string
  lat: number
  lng: number
  type: number
  startYear: number
  endYear: number
}

interface Corridor {
  name: string
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }
  sortAxis: 'lat' | 'lng' | 'lat-desc' | 'lng-desc'
}

const CORRIDORS: Corridor[] = [
  {
    name: "Hadrian's Wall",
    bounds: { minLat: 54.5, maxLat: 55.5, minLng: -4, maxLng: -1.4 },
    sortAxis: 'lng',
  },
  {
    name: 'Antonine Wall',
    bounds: { minLat: 55.8, maxLat: 56.2, minLng: -4.8, maxLng: -3.3 },
    sortAxis: 'lng',
  },
  {
    name: 'Rhine Limes',
    bounds: { minLat: 47.5, maxLat: 52.5, minLng: 4.5, maxLng: 8.5 },
    sortAxis: 'lat-desc',
  },
  {
    name: 'Upper Germanic-Raetian Limes',
    bounds: { minLat: 47.8, maxLat: 50.5, minLng: 8.5, maxLng: 12.5 },
    sortAxis: 'lng',
  },
  {
    name: 'Danube Limes (West)',
    bounds: { minLat: 45.0, maxLat: 48.5, minLng: 12.5, maxLng: 21.0 },
    sortAxis: 'lng',
  },
  {
    name: 'Danube Limes (East)',
    bounds: { minLat: 42.0, maxLat: 46.0, minLng: 21.0, maxLng: 29.5 },
    sortAxis: 'lng',
  },
  {
    name: 'African Limes',
    bounds: { minLat: 30.0, maxLat: 36.0, minLng: -2.0, maxLng: 12.0 },
    sortAxis: 'lng',
  },
  {
    name: 'Eastern Frontier',
    bounds: { minLat: 31.0, maxLat: 42.0, minLng: 35.0, maxLng: 46.0 },
    sortAxis: 'lat-desc',
  },
]

const MAX_DISTANCE_KM = 80

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function sortForts(forts: Settlement[], axis: Corridor['sortAxis']): Settlement[] {
  const sorted = [...forts]
  switch (axis) {
    case 'lng':
      return sorted.sort((a, b) => a.lng - b.lng)
    case 'lng-desc':
      return sorted.sort((a, b) => b.lng - a.lng)
    case 'lat':
      return sorted.sort((a, b) => a.lat - b.lat)
    case 'lat-desc':
      return sorted.sort((a, b) => b.lat - a.lat)
  }
}

async function main() {
  const settlementsPath = fileURLToPath(
    new URL('../src/data/dare/settlements.json', import.meta.url),
  )
  const settlements: Settlement[] = JSON.parse(await readFile(settlementsPath, 'utf-8'))

  const forts = settlements.filter((s) => s.type === 17 || s.type === 18)
  console.log(`Total forts (type 17+18): ${forts.length}`)

  const features: Array<{
    type: 'Feature'
    properties: { sector: string; startYear: number; endYear: number }
    geometry: { type: 'LineString'; coordinates: [number, number][] }
  }> = []

  let totalSegments = 0

  for (const corridor of CORRIDORS) {
    const { bounds } = corridor
    const corridorForts = forts.filter(
      (f) =>
        f.lat >= bounds.minLat &&
        f.lat <= bounds.maxLat &&
        f.lng >= bounds.minLng &&
        f.lng <= bounds.maxLng,
    )

    const sorted = sortForts(corridorForts, corridor.sortAxis)

    let segmentCount = 0
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]
      const b = sorted[i + 1]
      const dist = haversineKm(a.lat, a.lng, b.lat, b.lng)
      if (dist > MAX_DISTANCE_KM) continue

      // Temporal data: segment active when both endpoints exist
      const startYear =
        a.startYear !== 0 && b.startYear !== 0
          ? Math.max(a.startYear, b.startYear)
          : a.startYear !== 0
            ? a.startYear
            : b.startYear
      const endYear =
        a.endYear !== 0 && b.endYear !== 0
          ? Math.min(a.endYear, b.endYear)
          : a.endYear !== 0
            ? a.endYear
            : b.endYear

      features.push({
        type: 'Feature',
        properties: {
          sector: corridor.name,
          startYear,
          endYear,
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [Math.round(a.lng * 10000) / 10000, Math.round(a.lat * 10000) / 10000],
            [Math.round(b.lng * 10000) / 10000, Math.round(b.lat * 10000) / 10000],
          ],
        },
      })
      segmentCount++
    }

    totalSegments += segmentCount
    console.log(`  ${corridor.name}: ${corridorForts.length} forts → ${segmentCount} segments`)
  }

  const collection = {
    type: 'FeatureCollection' as const,
    features,
  }

  const json = JSON.stringify(collection)
  const outPath = fileURLToPath(new URL('../src/data/dare/limes.json', import.meta.url))
  await writeFile(outPath, json + '\n')
  console.log(`\n✓ Limes: ${totalSegments} segments, ${(json.length / 1024).toFixed(0)} KB`)
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
