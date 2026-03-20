/**
 * Script A: Enrich entities (people + locations) that already have Wikipedia URLs.
 *
 * Usage: npx tsx scripts/enrich-wikipedia-from-urls.ts
 */

import { writeFile, mkdir } from 'fs/promises'
import { fileURLToPath } from 'url'
import {
  fetchWikiSummary,
  buildEnrichment,
  loadExistingOutput,
  type WikiLookup,
} from './lib/wiki-api'

interface Entity {
  id: string
  name: string
  entityType: string
  sources: string[]
}

function extractWikiTitle(sources: string[]): string | null {
  for (const src of sources) {
    const match = src.match(/en\.wikipedia\.org\/wiki\/(.+?)(?:#.*)?$/)
    if (match) return decodeURIComponent(match[1].replace(/_/g, ' '))
  }
  return null
}

async function main() {
  console.log('Script A: Enriching entities from Wikipedia URLs...\n')

  const outDir = fileURLToPath(new URL('../src/data/wiki', import.meta.url))
  await mkdir(outDir, { recursive: true })
  const outPath = fileURLToPath(new URL('../src/data/wiki/entities-wiki.json', import.meta.url))

  // Load existing output for resume
  const existing = await loadExistingOutput(outPath)
  const result: WikiLookup = { ...existing }

  // Load people and locations
  const peoplePath = fileURLToPath(new URL('../src/data/entities/people.json', import.meta.url))
  const locationsPath = fileURLToPath(
    new URL('../src/data/entities/locations.json', import.meta.url),
  )

  const { readFile } = await import('fs/promises')
  const people: Entity[] = JSON.parse(await readFile(peoplePath, 'utf-8'))
  const locations: Entity[] = JSON.parse(await readFile(locationsPath, 'utf-8'))
  const allEntities = [...people, ...locations]

  console.log(`  People: ${people.length}, Locations: ${locations.length}`)
  console.log(`  Already enriched: ${Object.keys(existing).length}`)

  let success = 0
  let skipped = 0
  let noUrl = 0
  let failed = 0

  for (const entity of allEntities) {
    if (result[entity.id]) {
      skipped++
      continue
    }

    const wikiTitle = extractWikiTitle(entity.sources)
    if (!wikiTitle) {
      noUrl++
      continue
    }

    const summary = await fetchWikiSummary(wikiTitle)
    if (!summary) {
      failed++
      console.warn(`  MISS: ${entity.name} (${wikiTitle})`)
      continue
    }

    result[entity.id] = buildEnrichment(summary, 'url', 0.95)
    success++

    if (success % 25 === 0) {
      console.log(`  Progress: ${success} enriched...`)
      // Checkpoint save
      await writeFile(outPath, JSON.stringify(result, null, 2) + '\n')
    }
  }

  // Final save
  await writeFile(outPath, JSON.stringify(result, null, 2) + '\n')

  const totalEntries = Object.keys(result).length
  console.log(`\nResults:`)
  console.log(`  Total enriched: ${totalEntries}`)
  console.log(`  New this run: ${success}`)
  console.log(`  Skipped (already done): ${skipped}`)
  console.log(`  No Wikipedia URL: ${noUrl}`)
  console.log(`  Failed lookups: ${failed}`)
  console.log(`  Output: ${outPath}`)

  // Sample output
  const sample = Object.entries(result).slice(0, 3)
  console.log(`\nSample entries:`)
  for (const [id, enrichment] of sample) {
    console.log(
      `  ${id}: "${enrichment.wikiTitle}" (${enrichment.extract.length} chars, thumb: ${!!enrichment.thumbnail})`,
    )
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
