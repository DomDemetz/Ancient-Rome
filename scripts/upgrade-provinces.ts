/**
 * Script to extract AWMC boundary/infrastructure data into separate layer files.
 * Extracts aqueducts, walls, and senatorial province boundaries from awmc-features.json.
 *
 * Usage: npx tsx scripts/upgrade-provinces.ts
 */

import { writeFile, readFile } from 'fs/promises'
import { fileURLToPath } from 'url'

interface GeoFeature {
  type: 'Feature'
  properties: Record<string, unknown>
  geometry: {
    type: string
    coordinates: unknown
  }
}

interface FeatureCollection {
  type: 'FeatureCollection'
  features: GeoFeature[]
}

function truncateCoord(n: number): number {
  return Math.round(n * 10000) / 10000
}

function truncateCoords(coords: unknown): unknown {
  if (typeof coords === 'number') return truncateCoord(coords)
  if (Array.isArray(coords)) return coords.map(truncateCoords)
  return coords
}

async function main() {
  console.log('Upgrading province and infrastructure layers from AWMC data...\n')

  // Load AWMC features
  const awmcPath = fileURLToPath(new URL('../src/data/awmc-features.json', import.meta.url))
  const awmcRaw = await readFile(awmcPath, 'utf-8')
  const awmcData = JSON.parse(awmcRaw) as FeatureCollection
  console.log(`Loaded ${awmcData.features.length} AWMC features\n`)

  // --- 1. Extract aqueducts ---
  console.log('Processing aqueducts...')
  const aqueductFeatures = awmcData.features
    .filter((f) => f.properties?.awmc_type === 'aqueduct')
    .map((f) => ({
      type: 'Feature' as const,
      properties: {
        ...(f.properties?.Name ? { name: String(f.properties.Name) } : {}),
        ...(f.properties?.en_name ? { name: String(f.properties.en_name) } : {}),
        source: 'AWMC',
        startYear: 0,
        endYear: 0,
      },
      geometry: {
        type: f.geometry.type,
        coordinates: truncateCoords(f.geometry.coordinates),
      },
    }))

  const aqueductCollection = {
    type: 'FeatureCollection' as const,
    features: aqueductFeatures,
  }
  const aqueductJson = JSON.stringify(aqueductCollection)
  const aqueductOutPath = fileURLToPath(new URL('../src/data/awmc-aqueducts.json', import.meta.url))
  await writeFile(aqueductOutPath, aqueductJson + '\n')
  console.log(
    `  ✓ Aqueducts: ${aqueductFeatures.length} features, ${(aqueductJson.length / 1024).toFixed(0)} KB`,
  )

  // --- 2. Merge walls into existing fortifications ---
  console.log('\nProcessing walls...')
  const fortPath = fileURLToPath(new URL('../src/data/dare/fortifications.json', import.meta.url))
  const fortRaw = await readFile(fortPath, 'utf-8')
  const fortData = JSON.parse(fortRaw) as FeatureCollection

  // Filter out any previously-added AWMC features to avoid duplicates on re-run
  const existingFortFeatures = fortData.features.filter((f) => f.properties?.source !== 'AWMC')

  const wallFeatures = awmcData.features
    .filter((f) => f.properties?.awmc_type === 'wall')
    .map((f) => ({
      type: 'Feature' as const,
      properties: {
        ...(f.properties?.id ? { name: String(f.properties.id) } : {}),
        source: 'AWMC',
      },
      geometry: {
        type: f.geometry.type,
        coordinates: truncateCoords(f.geometry.coordinates),
      },
    }))

  const mergedFortCollection = {
    type: 'FeatureCollection' as const,
    features: [...existingFortFeatures, ...wallFeatures],
  }
  const fortJson = JSON.stringify(mergedFortCollection)
  await writeFile(fortPath, fortJson + '\n')
  console.log(`  ✓ Walls: ${wallFeatures.length} AWMC wall features added to fortifications`)
  console.log(
    `  ✓ Fortifications total: ${mergedFortCollection.features.length} features (${existingFortFeatures.length} existing + ${wallFeatures.length} AWMC), ${(fortJson.length / 1024).toFixed(0)} KB`,
  )

  // --- 3. Extract senatorial provinces ---
  console.log('\nProcessing senatorial provinces...')
  const senatorialFeatures = awmcData.features
    .filter((f) => f.properties?.awmc_type === 'senatorial_province')
    .map((f) => ({
      type: 'Feature' as const,
      properties: {
        source: 'AWMC',
        type: 'senatorial',
      },
      geometry: {
        type: f.geometry.type,
        coordinates: truncateCoords(f.geometry.coordinates),
      },
    }))

  const senatorialCollection = {
    type: 'FeatureCollection' as const,
    features: senatorialFeatures,
  }
  const senatorialJson = JSON.stringify(senatorialCollection)
  const senatorialOutPath = fileURLToPath(
    new URL('../src/data/dare/senatorial-provinces.json', import.meta.url),
  )
  await writeFile(senatorialOutPath, senatorialJson + '\n')
  console.log(
    `  ✓ Senatorial provinces: ${senatorialFeatures.length} features, ${(senatorialJson.length / 1024).toFixed(0)} KB`,
  )

  // --- Summary ---
  console.log('\n✓ AWMC layer extraction complete')
  console.log(
    `  Aqueducts:           ${aqueductFeatures.length} polyline routes → ${aqueductOutPath}`,
  )
  console.log(`  Walls:               ${wallFeatures.length} features merged → ${fortPath}`)
  console.log(
    `  Senatorial provinces: ${senatorialFeatures.length} polygons → ${senatorialOutPath}`,
  )
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
