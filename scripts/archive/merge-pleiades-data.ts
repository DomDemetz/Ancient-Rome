/**
 * Merges Pleiades-sourced data with existing curated data files.
 * Run after ingest-pleiades-all.ts to combine bulk + curated entries.
 *
 * Usage: npx tsx scripts/merge-pleiades-data.ts
 */

import { readFile, writeFile } from 'fs/promises'
import { fileURLToPath } from 'url'

function resolve(rel: string): string {
  return fileURLToPath(new URL(rel, import.meta.url))
}

interface HasCoords {
  lat: number
  lng: number
  id: string
}

// Deduplicate by proximity: skip items within `threshold` degrees of existing entries
function deduplicateByProximity<T extends HasCoords>(
  existing: T[],
  incoming: T[],
  threshold = 0.01,
): T[] {
  const added: T[] = []
  const existingIds = new Set(existing.map((e) => e.id))

  for (const item of incoming) {
    if (existingIds.has(item.id)) continue

    const tooClose = existing.some(
      (e) => Math.abs(e.lat - item.lat) < threshold && Math.abs(e.lng - item.lng) < threshold,
    )
    if (tooClose) continue

    // Also check against already-added items
    const tooCloseToAdded = added.some(
      (a) => Math.abs(a.lat - item.lat) < threshold && Math.abs(a.lng - item.lng) < threshold,
    )
    if (tooCloseToAdded) continue

    added.push(item)
  }

  return added
}

async function loadJSON<T>(path: string): Promise<T> {
  const raw = await readFile(path, 'utf-8')
  return JSON.parse(raw)
}

async function mergeDataset(
  name: string,
  curatedPath: string,
  pleiadesPath: string,
  threshold: number,
) {
  try {
    const curated = await loadJSON<HasCoords[]>(resolve(curatedPath))
    const pleiades = await loadJSON<HasCoords[]>(resolve(pleiadesPath))

    if (pleiades.length === 0) {
      console.log(`  ${name}: No Pleiades data to merge`)
      return
    }

    const newItems = deduplicateByProximity(curated, pleiades, threshold)
    const merged = [...curated, ...newItems]

    await writeFile(resolve(curatedPath), JSON.stringify(merged) + '\n')
    console.log(
      `  ${name}: ${curated.length} curated + ${newItems.length} from Pleiades (${pleiades.length - newItems.length} duplicates skipped) = ${merged.length} total`,
    )
  } catch (err) {
    console.log(`  ${name}: Skipped - ${(err as Error).message}`)
  }
}

async function main() {
  console.log('Merging Pleiades data with curated datasets...\n')

  await mergeDataset(
    'Mines & Quarries',
    '../src/data/mines/mines.json',
    '../src/data/mines/mines-pleiades.json',
    0.05, // ~5km dedup radius for mines
  )

  await mergeDataset(
    'Religious Sites',
    '../src/data/religion/religion.json',
    '../src/data/religion/religion-pleiades.json',
    0.02, // ~2km dedup radius for religious sites
  )

  console.log('\nDone.')
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
