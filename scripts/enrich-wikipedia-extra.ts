/**
 * Script D: Enrich additional layers — emperors, legions, aqueducts, ports,
 * religious sites, and remaining entity sub-types.
 *
 * Usage: npx tsx scripts/enrich-wikipedia-extra.ts
 */

import { writeFile, readFile, mkdir } from 'fs/promises'
import { fileURLToPath } from 'url'
import {
  fetchWikiSummary,
  searchWikipedia,
  buildEnrichment,
  loadExistingOutput,
  type WikiLookup,
  type WikiSummary,
} from './lib/wiki-api'

// --- Helpers ---

function extractWikiTitle(sources: string[]): string | null {
  for (const src of sources) {
    const match = src.match(/en\.wikipedia\.org\/wiki\/(.+?)(?:#.*)?$/)
    if (match) return decodeURIComponent(match[1].replace(/_/g, ' '))
  }
  return null
}

function isRomanEraArticle(summary: WikiSummary): boolean {
  const extract = (summary.extract || '').toLowerCase()
  const ANCIENT = [
    'roman',
    'ancient',
    'ruins',
    'archaeological',
    'gladiat',
    'antiquity',
    'classical',
    'imperial',
    'latin',
    'hellenistic',
    'emperor',
    'consul',
    'legion',
    'senate',
    'republic',
    'empire',
  ]
  const hasAncient = ANCIENT.some((kw) => extract.includes(kw))
  const hasDate =
    /\b\d+\s*(BC|AD|BCE|CE)\b/i.test(extract) || /\b\d{1,2}(st|nd|rd|th)\s+century\b/i.test(extract)
  return hasAncient || hasDate
}

function isNotGarbage(summary: WikiSummary): boolean {
  const extract = (summary.extract || '').toLowerCase()
  const first = extract.split(/\.\s/)[0] || ''
  return !/\b(video game|computer game|footballer|singer|songwriter|album|tv series|school district|basketball|soccer)\b/.test(
    first,
  )
}

const OUT_DIR = fileURLToPath(new URL('../src/data/wiki', import.meta.url))

// --- Emperors ---

async function enrichEmperors(): Promise<void> {
  console.log('=== Emperors ===')
  interface Emperor {
    id: string
    name: string
    dynasty: string
  }
  const emps: Emperor[] = JSON.parse(
    await readFile(
      fileURLToPath(new URL('../src/data/emperors/emperors.json', import.meta.url)),
      'utf-8',
    ),
  )

  const outPath = OUT_DIR + '/emperors-wiki.json'
  const existing = await loadExistingOutput(outPath)
  const result: WikiLookup = { ...existing }

  let success = 0,
    skipped = 0,
    missed = 0
  for (const emp of emps) {
    if (result[emp.id]) {
      skipped++
      continue
    }

    // Emperors have well-known names — search directly
    // Try short name first (e.g. "Augustus" not "Gaius Julius Caesar Augustus")
    const shortName = emp.name.split(' ').pop() || emp.name
    const searchTerms = [emp.name, shortName, `${shortName} emperor`, `${shortName} Roman emperor`]

    let found = false
    for (const term of searchTerms) {
      const titles = await searchWikipedia(term)
      for (const t of titles.slice(0, 3)) {
        const summary = await fetchWikiSummary(t)
        if (!summary?.extract) continue
        // Must mention emperor/roman/reign
        const ext = summary.extract.toLowerCase()
        if (
          /\b(emperor|roman|reign|consul|caesar|augustus|princeps)\b/.test(ext) &&
          isNotGarbage(summary)
        ) {
          result[emp.id] = buildEnrichment(summary, 'name-search', 0.9)
          success++
          found = true
          break
        }
      }
      if (found) break
    }
    if (!found) {
      missed++
      console.log(`  MISS: ${emp.name}`)
    }
  }

  await writeFile(outPath, JSON.stringify(result, null, 2) + '\n')
  console.log(
    `  Total: ${emps.length}, enriched: ${Object.keys(result).length}, new: ${success}, skipped: ${skipped}, missed: ${missed}\n`,
  )
}

// --- Legions ---

async function enrichLegions(): Promise<void> {
  console.log('=== Legions ===')
  interface Legion {
    id: string
    name: string
    cognomen: string | null
    number: string
  }
  const legions: Legion[] = JSON.parse(
    await readFile(
      fileURLToPath(new URL('../src/data/legions/legions.json', import.meta.url)),
      'utf-8',
    ),
  )

  const outPath = OUT_DIR + '/legions-wiki.json'
  const existing = await loadExistingOutput(outPath)
  const result: WikiLookup = { ...existing }

  let success = 0,
    skipped = 0,
    missed = 0
  for (const leg of legions) {
    if (result[leg.id]) {
      skipped++
      continue
    }

    const searchTerms = [leg.name, `${leg.name} Roman legion`]
    let found = false
    for (const term of searchTerms) {
      const titles = await searchWikipedia(term)
      for (const t of titles.slice(0, 3)) {
        const summary = await fetchWikiSummary(t)
        if (!summary?.extract) continue
        const ext = summary.extract.toLowerCase()
        if (/\b(legion|legio|roman|military)\b/.test(ext) && isNotGarbage(summary)) {
          result[leg.id] = buildEnrichment(summary, 'name-search', 0.85)
          success++
          found = true
          break
        }
      }
      if (found) break
    }
    if (!found) {
      missed++
      console.log(`  MISS: ${leg.name}`)
    }
  }

  await writeFile(outPath, JSON.stringify(result, null, 2) + '\n')
  console.log(
    `  Total: ${legions.length}, enriched: ${Object.keys(result).length}, new: ${success}, skipped: ${skipped}, missed: ${missed}\n`,
  )
}

// --- Aqueducts ---

async function enrichAqueducts(): Promise<void> {
  console.log('=== Aqueducts ===')
  interface Aqueduct {
    id: string
    name: string
    cityServed: string | null
  }
  const aqueducts: Aqueduct[] = JSON.parse(
    await readFile(
      fileURLToPath(new URL('../src/data/aqueducts/aqueducts.json', import.meta.url)),
      'utf-8',
    ),
  )

  const outPath = OUT_DIR + '/aqueducts-wiki.json'
  const existing = await loadExistingOutput(outPath)
  const result: WikiLookup = { ...existing }

  let success = 0,
    skipped = 0,
    missed = 0
  for (const aq of aqueducts) {
    if (result[aq.id]) {
      skipped++
      continue
    }

    const searchTerms = [
      aq.name,
      `${aq.name} aqueduct`,
      aq.cityServed ? `${aq.cityServed} aqueduct` : null,
    ].filter(Boolean) as string[]

    let found = false
    for (const term of searchTerms) {
      const titles = await searchWikipedia(term)
      for (const t of titles.slice(0, 3)) {
        const summary = await fetchWikiSummary(t)
        if (!summary?.extract) continue
        const ext = summary.extract.toLowerCase()
        // Must be about an aqueduct/water supply AND ancient/Roman
        if (
          /\b(aqueduct|water supply|conduit|aqua)\b/.test(ext) &&
          isRomanEraArticle(summary) &&
          isNotGarbage(summary)
        ) {
          result[aq.id] = buildEnrichment(summary, 'name-search', 0.8)
          success++
          found = true
          break
        }
      }
      if (found) break
    }
    if (!found) missed++
  }

  await writeFile(outPath, JSON.stringify(result, null, 2) + '\n')
  console.log(
    `  Total: ${aqueducts.length}, enriched: ${Object.keys(result).length}, new: ${success}, skipped: ${skipped}, missed: ${missed}\n`,
  )
}

// --- Ports (major only) ---

async function enrichPorts(): Promise<void> {
  console.log('=== Ports ===')
  interface Port {
    id: string
    name: string
    portType: string
    description: string
  }
  const ports: Port[] = JSON.parse(
    await readFile(
      fileURLToPath(new URL('../src/data/ancient-ports.json', import.meta.url)),
      'utf-8',
    ),
  )

  // Only major ports and ports with names > 3 chars
  const candidates = ports.filter(
    (p) => (p.portType === 'major_port' || p.portType === 'port') && p.name.length > 3,
  )
  console.log(
    `  Total ports: ${ports.length}, candidates (major/port with name): ${candidates.length}`,
  )

  const outPath = OUT_DIR + '/ports-wiki.json'
  const existing = await loadExistingOutput(outPath)
  const result: WikiLookup = { ...existing }

  let success = 0,
    skipped = 0,
    missed = 0
  for (const port of candidates) {
    if (result[port.id]) {
      skipped++
      continue
    }

    const searchTerms = [port.name, `${port.name} port`, `${port.name} ancient port`]
    let found = false
    for (const term of searchTerms) {
      const titles = await searchWikipedia(term)
      for (const t of titles.slice(0, 2)) {
        const summary = await fetchWikiSummary(t)
        if (!summary?.extract) continue
        if (isRomanEraArticle(summary) && isNotGarbage(summary)) {
          // Check name overlap
          const combined = (summary.extract + ' ' + summary.title).toLowerCase()
          const nameInArticle = port.name
            .toLowerCase()
            .split(/\s+/)
            .some((w) => w.length > 3 && combined.includes(w))
          if (nameInArticle) {
            result[port.id] = buildEnrichment(summary, 'name-search', 0.7)
            success++
            found = true
            break
          }
        }
      }
      if (found) break
    }
    if (!found) missed++

    // Checkpoint
    if ((success + missed) % 100 === 0 && success + missed > 0) {
      console.log(`  Progress: ${success} found, ${missed} missed`)
      await writeFile(outPath, JSON.stringify(result, null, 2) + '\n')
    }
  }

  await writeFile(outPath, JSON.stringify(result, null, 2) + '\n')
  console.log(
    `  Enriched: ${Object.keys(result).length}, new: ${success}, skipped: ${skipped}, missed: ${missed}\n`,
  )
}

// --- Remaining entity sub-types (events, dynasties, orgs, etc.) ---

async function enrichEntitySubtypes(): Promise<void> {
  console.log('=== Entity sub-types ===')

  interface Entity {
    id: string
    name: string
    entityType: string
    sources: string[]
  }
  const files = [
    'events',
    'dynasties',
    'organizations',
    'documents',
    'infrastructure',
    'legions',
    'religions',
    'trade-goods',
  ]

  // These go into the same entities-wiki.json
  const outPath = OUT_DIR + '/entities-wiki.json'
  const existing = await loadExistingOutput(outPath)
  const result: WikiLookup = { ...existing }

  let totalNew = 0
  for (const file of files) {
    const path = fileURLToPath(new URL(`../src/data/entities/${file}.json`, import.meta.url))
    let entities: Entity[]
    try {
      entities = JSON.parse(await readFile(path, 'utf-8'))
    } catch {
      continue
    }

    let success = 0,
      skipped = 0,
      failed = 0
    for (const entity of entities) {
      if (result[entity.id]) {
        skipped++
        continue
      }

      const wikiTitle = extractWikiTitle(entity.sources)
      if (wikiTitle) {
        const summary = await fetchWikiSummary(wikiTitle)
        if (summary) {
          result[entity.id] = buildEnrichment(summary, 'url', 0.95)
          success++
          continue
        }
      }

      // Fallback: search by name
      const titles = await searchWikipedia(entity.name)
      let found = false
      for (const t of titles.slice(0, 3)) {
        const summary = await fetchWikiSummary(t)
        if (summary && isRomanEraArticle(summary) && isNotGarbage(summary)) {
          result[entity.id] = buildEnrichment(summary, 'name-search', 0.75)
          success++
          found = true
          break
        }
      }
      if (!found) failed++
    }

    console.log(
      `  ${file}: ${entities.length} total, ${success} new, ${skipped} skipped, ${failed} failed`,
    )
    totalNew += success
  }

  await writeFile(outPath, JSON.stringify(result, null, 2) + '\n')
  console.log(`  Total entities enriched: ${Object.keys(result).length} (${totalNew} new)\n`)
}

// --- Main ---

async function main() {
  console.log('Script D: Enriching additional layers...\n')
  await mkdir(OUT_DIR, { recursive: true })

  await enrichEmperors()
  await enrichLegions()
  await enrichAqueducts()
  await enrichEntitySubtypes()
  await enrichPorts()

  console.log('Done.')
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
