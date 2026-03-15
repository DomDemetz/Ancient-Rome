/**
 * Script to integrate DARMC road data and ancient ports data.
 *
 * 1. Reads darmc-roads.json (7,154 segments with [lat, lng] coordinates),
 *    converts to GeoJSON FeatureCollection with [lng, lat] coordinates,
 *    and writes to src/data/darmc/roads.json.
 *
 * 2. Verifies ancient-ports.json is accessible for the ports data loader.
 *
 * Usage: npx tsx scripts/integrate-darmc-roads.ts
 */

import { readFile, writeFile } from 'fs/promises'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')

interface DarmcRoadSegment {
  id: string
  name: string
  coordinates: [number, number][] // [lat, lng]
  source: string
}

interface GeoJSONFeature {
  type: 'Feature'
  properties: { name: string; source: string }
  geometry: {
    type: 'LineString'
    coordinates: [number, number][] // [lng, lat]
  }
}

interface GeoJSONFeatureCollection {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
}

async function convertDarmcRoads(): Promise<void> {
  const inputPath = resolve(ROOT, 'src/data/darmc-roads.json')
  const outputPath = resolve(ROOT, 'src/data/darmc/roads.json')

  console.log('Reading DARMC road segments...')
  const raw = await readFile(inputPath, 'utf-8')
  const segments: DarmcRoadSegment[] = JSON.parse(raw)
  console.log(`  Found ${segments.length} road segments`)

  console.log('Converting to GeoJSON (swapping lat/lng to lng/lat)...')
  const features: GeoJSONFeature[] = segments.map((seg) => ({
    type: 'Feature' as const,
    properties: {
      name: seg.name,
      source: seg.source,
    },
    geometry: {
      type: 'LineString' as const,
      coordinates: seg.coordinates.map(([lat, lng]) => [lng, lat] as [number, number]),
    },
  }))

  const collection: GeoJSONFeatureCollection = {
    type: 'FeatureCollection',
    features,
  }

  console.log(`Writing GeoJSON with ${features.length} features...`)
  await writeFile(outputPath, JSON.stringify(collection), 'utf-8')
  console.log(`  Saved to ${outputPath}`)
}

async function verifyPorts(): Promise<void> {
  const portsPath = resolve(ROOT, 'src/data/ancient-ports.json')

  console.log('\nVerifying ancient ports data...')
  const raw = await readFile(portsPath, 'utf-8')
  const ports = JSON.parse(raw)
  console.log(`  Found ${ports.length} ancient ports`)
  console.log('  Ports data loader ready at src/data/ports/index.ts')
}

async function main(): Promise<void> {
  console.log('=== DARMC Roads & Ports Integration ===\n')

  await convertDarmcRoads()
  await verifyPorts()

  console.log('\nDone!')
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
