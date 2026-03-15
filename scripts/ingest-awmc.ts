/**
 * Script to ingest geographic data from the Ancient World Mapping Center (AWMC)
 * at UNC Chapel Hill. Downloads GeoJSON datasets for Roman roads, walls,
 * aqueducts, canals, urban areas, and political boundaries.
 *
 * Source: https://github.com/AWMC/geodata
 *
 * Usage: npx tsx scripts/ingest-awmc.ts
 */

import { writeFile, mkdir } from 'fs/promises'
import { fileURLToPath } from 'url'

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/AWMC/geodata/master'

interface AWMCDataset {
  name: string
  url: string
  category: 'roads' | 'features'
  featureType: string
}

const DATASETS: AWMCDataset[] = [
  // Roads
  {
    name: 'Roman Roads',
    url: `${GITHUB_RAW_BASE}/Cultural-Data/roads/roads.geojson`,
    category: 'roads',
    featureType: 'road',
  },
  // Walls (e.g. Hadrian's Wall, Antonine Wall)
  {
    name: 'Roman Walls',
    url: `${GITHUB_RAW_BASE}/Cultural-Data/walls/walls.geojson`,
    category: 'features',
    featureType: 'wall',
  },
  // Aqueducts
  {
    name: 'Roman Aqueducts',
    url: `${GITHUB_RAW_BASE}/Cultural-Data/aqueducts/aqueducts.geojson`,
    category: 'features',
    featureType: 'aqueduct',
  },
  // Canals
  {
    name: 'Roman Canals',
    url: `${GITHUB_RAW_BASE}/Cultural-Data/canals/canals.geojson`,
    category: 'features',
    featureType: 'canal',
  },
  // Urban areas
  {
    name: 'Urban Areas',
    url: `${GITHUB_RAW_BASE}/Cultural-Data/urban_areas/urban_areas.geojson`,
    category: 'features',
    featureType: 'urban_area',
  },
  // Political boundaries - Roman Empire at 117 CE (max extent)
  {
    name: 'Roman Empire 117 CE Extent',
    url: `${GITHUB_RAW_BASE}/Cultural-Data/political_shading/roman_empire_ce_117_extent/roman_empire_ce_117_extent.geojson`,
    category: 'features',
    featureType: 'empire_extent_117ce',
  },
  // Political boundaries - Roman Empire at 200 CE
  {
    name: 'Roman Empire 200 CE Extent',
    url: `${GITHUB_RAW_BASE}/Cultural-Data/political_shading/roman_empire_ce_200_extent/roman_empire_ce_200_extent.geojson`,
    category: 'features',
    featureType: 'empire_extent_200ce',
  },
  // Roman provinces at 200 CE
  {
    name: 'Roman Empire 200 CE Provinces',
    url: `${GITHUB_RAW_BASE}/Cultural-Data/political_shading/roman_empire_ce_200_provinces/roman_empire_ce_200_provinces.geojson`,
    category: 'features',
    featureType: 'province_200ce',
  },
  // Roman Republic at 60 BCE
  {
    name: 'Roman Republic 60 BCE',
    url: `${GITHUB_RAW_BASE}/Cultural-Data/political_shading/roman_empire_bce_60/roman_empire_bce_60.geojson`,
    category: 'features',
    featureType: 'empire_extent_60bce',
  },
  // Post-Diocletian provinces
  {
    name: 'Roman Empire Post-Diocletian Provinces',
    url: `${GITHUB_RAW_BASE}/Cultural-Data/political_shading/roman_empire_provinces%20post_diocletian/roman_empire_provinces%20post_diocletian.geojson`,
    category: 'features',
    featureType: 'province_post_diocletian',
  },
  // Senatorial provinces
  {
    name: 'Roman Senatorial Provinces',
    url: `${GITHUB_RAW_BASE}/Cultural-Data/political_shading/senatorial_province/roman_senatorial_provinces.geojson`,
    category: 'features',
    featureType: 'senatorial_province',
  },
]

interface GeoJSONFeature {
  type: 'Feature'
  geometry: {
    type: string
    coordinates: unknown
  }
  properties: Record<string, unknown>
}

interface GeoJSONFeatureCollection {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
}

async function fetchGeoJSON(dataset: AWMCDataset): Promise<GeoJSONFeatureCollection | null> {
  try {
    console.log(`  Fetching ${dataset.name} from ${dataset.url}...`)
    const res = await fetch(dataset.url)
    if (!res.ok) {
      console.log(`    FAILED: HTTP ${res.status} ${res.statusText}`)
      return null
    }
    const text = await res.text()
    console.log(`    Downloaded ${(text.length / 1024).toFixed(1)} KB`)

    const geojson = JSON.parse(text) as GeoJSONFeatureCollection

    if (!geojson.features || !Array.isArray(geojson.features)) {
      console.log(`    WARNING: No features array found`)
      return null
    }

    console.log(`    Contains ${geojson.features.length} features`)
    return geojson
  } catch (err) {
    console.log(`    ERROR: ${err}`)
    return null
  }
}

function summarizeGeometryTypes(features: GeoJSONFeature[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const f of features) {
    const t = f.geometry?.type || 'unknown'
    counts[t] = (counts[t] || 0) + 1
  }
  return counts
}

function summarizeProperties(features: GeoJSONFeature[]): string[] {
  const allKeys = new Set<string>()
  for (const f of features.slice(0, 10)) {
    if (f.properties) {
      for (const key of Object.keys(f.properties)) {
        allKeys.add(key)
      }
    }
  }
  return Array.from(allKeys).sort()
}

async function main() {
  console.log('=== AWMC GeoData Ingestion ===')
  console.log('Source: Ancient World Mapping Center, UNC Chapel Hill')
  console.log('Repository: https://github.com/AWMC/geodata\n')

  const roadFeatures: GeoJSONFeature[] = []
  const otherFeatures: GeoJSONFeature[] = []

  let successCount = 0
  let failCount = 0

  for (const dataset of DATASETS) {
    const geojson = await fetchGeoJSON(dataset)

    if (!geojson) {
      failCount++
      continue
    }

    successCount++

    // Log geometry types and sample properties
    const geomTypes = summarizeGeometryTypes(geojson.features)
    console.log(
      `    Geometry types: ${Object.entries(geomTypes)
        .map(([t, c]) => `${t}(${c})`)
        .join(', ')}`,
    )

    const propKeys = summarizeProperties(geojson.features)
    if (propKeys.length > 0) {
      console.log(`    Properties: ${propKeys.join(', ')}`)
    }

    // Tag each feature with its AWMC source type
    const taggedFeatures = geojson.features.map((f) => ({
      ...f,
      properties: {
        ...f.properties,
        awmc_type: dataset.featureType,
        awmc_source: dataset.name,
      },
    }))

    if (dataset.category === 'roads') {
      roadFeatures.push(...taggedFeatures)
    } else {
      otherFeatures.push(...taggedFeatures)
    }

    console.log('')
  }

  console.log(`\n=== Download Summary ===`)
  console.log(`  Successful: ${successCount}/${DATASETS.length}`)
  console.log(`  Failed: ${failCount}/${DATASETS.length}`)
  console.log(`  Road features: ${roadFeatures.length}`)
  console.log(`  Other features: ${otherFeatures.length}`)

  // Ensure output directory exists
  const outDir = fileURLToPath(new URL('../src/data', import.meta.url))
  await mkdir(outDir, { recursive: true })

  // Write roads
  if (roadFeatures.length > 0) {
    const roadsCollection: GeoJSONFeatureCollection = {
      type: 'FeatureCollection',
      features: roadFeatures,
    }
    const roadsPath = fileURLToPath(new URL('../src/data/awmc-roads.json', import.meta.url))
    const roadsJson = JSON.stringify(roadsCollection)
    await writeFile(roadsPath, roadsJson + '\n')
    console.log(`\n  Roads written to ${roadsPath}`)
    console.log(`  Roads file size: ${(roadsJson.length / 1024).toFixed(1)} KB`)
  } else {
    console.log('\n  No road data to write.')
  }

  // Write other features
  if (otherFeatures.length > 0) {
    const featuresCollection: GeoJSONFeatureCollection = {
      type: 'FeatureCollection',
      features: otherFeatures,
    }
    const featuresPath = fileURLToPath(new URL('../src/data/awmc-features.json', import.meta.url))
    const featuresJson = JSON.stringify(featuresCollection)
    await writeFile(featuresPath, featuresJson + '\n')
    console.log(`  Features written to ${featuresPath}`)
    console.log(`  Features file size: ${(featuresJson.length / 1024).toFixed(1)} KB`)
  } else {
    console.log('  No feature data to write.')
  }

  console.log('\nAWMC ingestion complete!')
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
