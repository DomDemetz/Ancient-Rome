/**
 * Script B: Enrich amphitheaters and buildings via Pleiades ID → Wikidata → Wikipedia.
 *
 * For amphitheaters: validates the article is actually about an amphitheater,
 * not just the settlement. Falls back to targeted Wikipedia search.
 *
 * Usage: npx tsx scripts/enrich-wikipedia-from-pleiades.ts
 */

import { writeFile, readFile, mkdir } from 'fs/promises'
import { fileURLToPath } from 'url'
import {
  sparqlQuery,
  fetchWikiSummary,
  searchWikipedia,
  buildEnrichment,
  loadExistingOutput,
  type WikiLookup,
  type WikiSummary,
} from './lib/wiki-api'

interface Amphitheater {
  id: string
  name: string
  city: string
  pleiadesId: string | null
}

interface Building {
  id: string
  name: string
  buildingType: string
  source: string
}

const AMPHITHEATER_KEYWORDS = [
  'amphitheat',
  'amphithéât',
  'colosseum',
  'coliseum',
  'arena',
  'gladiat',
]

function isAmphitheaterArticle(summary: WikiSummary): boolean {
  const title = (summary.title || '').toLowerCase()
  const extract = (summary.extract || '').toLowerCase()
  const firstSentence = extract.split(/\.\s/)[0] || ''

  // Must mention amphitheater keywords somewhere
  const hasAmpKeyword = AMPHITHEATER_KEYWORDS.some(
    (kw) => title.includes(kw) || firstSentence.includes(kw),
  )
  if (!hasAmpKeyword) return false

  // Must be about something ancient/Roman — reject modern venues, schools, etc.
  const ANCIENT_MARKERS = [
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
  ]
  const hasAncientMarker = ANCIENT_MARKERS.some((kw) => extract.includes(kw))
  const hasHistoricDate =
    /\b\d+\s*(BC|AD|BCE|CE)\b/i.test(extract) || /\b\d{1,2}(st|nd|rd|th)\s+century\b/i.test(extract)

  if (!hasAncientMarker && !hasHistoricDate) return false

  // Reject if first sentence is clearly about a city/town/modern entity
  const isCityArticle =
    /\b(city|town|commune|municipality|village|region|capital|school|district|stadium|football|basketball|soccer)\b/.test(
      firstSentence,
    )

  return !isCityArticle
}

/** Map of building type keywords to validate article relevance */
const BUILDING_TYPE_KEYWORDS: Record<string, string[]> = {
  temple: ['temple', 'shrine', 'sanctuary', 'worship', 'dedicat'],
  theater: ['theat', 'odeon', 'odeum', 'performan'],
  bath: ['bath', 'thermae', 'thermal', 'balneo'],
  forum: ['forum', 'agora', 'public square', 'market'],
  circus: ['circus', 'hippodrome', 'chariot', 'race'],
  basilica: ['basilica', 'hall', 'court'],
  arch: ['arch', 'triumphal', 'gate'],
  bridge: ['bridge', 'pont', 'viaduct'],
  aqueduct: ['aqueduct', 'water supply', 'conduit'],
  palace: ['palace', 'villa', 'residence', 'domus'],
  library: ['library', 'bibliothec'],
  nymphaeum: ['nymphaeum', 'fountain', 'nymphaion'],
}

function isBuildingArticleRelevant(summary: WikiSummary, buildingType: string): boolean {
  const text = (summary.extract || '').toLowerCase()
  const title = (summary.title || '').toLowerCase()
  const combined = text + ' ' + title

  // Check type-specific keywords
  const keywords = BUILDING_TYPE_KEYWORDS[buildingType]
  if (keywords && keywords.some((kw) => combined.includes(kw))) return true

  // Generic: if it mentions "roman" + "built/construct/erected" it's probably relevant
  if (
    combined.includes('roman') &&
    /\b(built|construct|erect|dedicat|commission)\b/.test(combined)
  ) {
    return true
  }

  return false
}

// --- SPARQL resolution ---

interface PleiadesMatch {
  wikidataId: string
  articleUrl: string
}

async function resolvePleiadesViaSparql(
  items: { entityId: string; pleiadesId: string }[],
): Promise<Map<string, PleiadesMatch>> {
  const BATCH_SIZE = 50
  const allMatches = new Map<string, PleiadesMatch>()

  const batches: (typeof items)[] = []
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    batches.push(items.slice(i, i + BATCH_SIZE))
  }

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi]
    console.log(`  SPARQL batch ${bi + 1}/${batches.length} (${batch.length} IDs)...`)

    const pleiadesValues = batch.map((b) => `"${b.pleiadesId}"`).join(' ')
    const query = `
      SELECT ?item ?pleiades ?article WHERE {
        VALUES ?pleiades { ${pleiadesValues} }
        ?item wdt:P1584 ?pleiades .
        ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .
      }
    `

    try {
      const bindings = await sparqlQuery(query)
      for (const b of bindings) {
        const pleiades = String(b.pleiades)
        const item = String(b.item)
        const article = String(b.article)
        const wikidataId = item.split('/').pop() || ''
        allMatches.set(pleiades, { wikidataId, articleUrl: article })
      }
    } catch (err) {
      console.warn(`  SPARQL batch ${bi + 1} failed: ${(err as Error).message}`)
    }
  }

  return allMatches
}

function extractTitleFromUrl(url: string): string | null {
  const match = url.match(/\/wiki\/(.+?)$/)
  if (!match) return null
  return decodeURIComponent(match[1].replace(/_/g, ' '))
}

// --- Amphitheater enrichment ---

async function enrichAmphitheaters(): Promise<void> {
  console.log('Processing amphitheaters...')

  const ampPath = fileURLToPath(
    new URL('../src/data/amphitheaters/amphitheaters.json', import.meta.url),
  )
  const amphitheaters: Amphitheater[] = JSON.parse(await readFile(ampPath, 'utf-8'))
  const ampWithPleiades = amphitheaters
    .filter((a) => a.pleiadesId)
    .map((a) => ({ entityId: a.id, pleiadesId: a.pleiadesId!, name: a.name, city: a.city }))

  console.log(`  Total: ${amphitheaters.length}, with Pleiades ID: ${ampWithPleiades.length}`)

  // Resume from existing validated results
  const ampOutPath = fileURLToPath(
    new URL('../src/data/wiki/amphitheaters-wiki.json', import.meta.url),
  )
  const existing = await loadExistingOutput(ampOutPath)
  const result: WikiLookup = { ...existing }
  const alreadyDone = new Set(Object.keys(existing))
  console.log(`  Already enriched (resuming): ${alreadyDone.size}`)

  // Only SPARQL-resolve items we haven't resolved yet
  const toResolve = ampWithPleiades.filter((a) => !alreadyDone.has(a.entityId))
  console.log(`  To process: ${toResolve.length}`)

  if (toResolve.length === 0) {
    console.log(`  Nothing to do — all amphitheaters already processed.`)
    return
  }

  // Step 1: SPARQL resolution (only for unprocessed)
  const pleiadesMatches = await resolvePleiadesViaSparql(toResolve)

  let directHit = 0
  let searchHit = 0
  let rejected = 0
  let missed = 0

  for (const amp of toResolve) {
    const match = pleiadesMatches.get(amp.pleiadesId)

    // Step 2: Try Pleiades-resolved article, but validate it's about an amphitheater
    if (match) {
      const title = extractTitleFromUrl(match.articleUrl)
      if (title) {
        const summary = await fetchWikiSummary(title)
        if (summary && isAmphitheaterArticle(summary)) {
          result[amp.entityId] = buildEnrichment(summary, 'pleiades', 0.95, match.wikidataId)
          directHit++
          continue
        }
        if (summary) {
          rejected++
        }
      }
    }

    // Step 3: Fallback — search Wikipedia for amphitheater-specific article
    // Use higher delays (500ms) to avoid 429s
    const city = amp.city || amp.name
    const searchTerms = [
      `amphitheatre of ${city}`,
      `${city} amphitheatre`,
      `${city} arena`,
      `Roman amphitheatre ${city}`,
      `amphitheater ${amp.name}`,
      `${amp.name} Roman arena`,
    ]
    // Deduplicate search terms
    const uniqueTerms = [...new Set(searchTerms.map((t) => t.toLowerCase()))].map(
      (lower) => searchTerms.find((t) => t.toLowerCase() === lower)!,
    )

    let found = false
    for (const term of uniqueTerms) {
      // Extra delay between search terms to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500))
      const titles = await searchWikipedia(term)
      for (const t of titles.slice(0, 2)) {
        await new Promise((resolve) => setTimeout(resolve, 300))
        const summary = await fetchWikiSummary(t)
        if (summary && isAmphitheaterArticle(summary)) {
          result[amp.entityId] = buildEnrichment(summary, 'name-search', 0.8)
          searchHit++
          found = true
          break
        }
      }
      if (found) break
    }

    if (!found) missed++

    // Checkpoint save every 25 items
    if ((directHit + searchHit + missed) % 25 === 0) {
      console.log(
        `  Progress: ${directHit} direct, ${searchHit} search, ${rejected} rejected, ${missed} missed`,
      )
      await writeFile(ampOutPath, JSON.stringify(result, null, 2) + '\n')
    }
  }

  await writeFile(ampOutPath, JSON.stringify(result, null, 2) + '\n')

  const total = Object.keys(result).length
  console.log(`\n  Results:`)
  console.log(`    Direct Pleiades hits (amphitheater article): ${directHit}`)
  console.log(`    Wikipedia search hits: ${searchHit}`)
  console.log(`    Rejected (settlement article, not amphitheater): ${rejected}`)
  console.log(`    No match found: ${missed}`)
  console.log(
    `    Total enriched: ${total}/${ampWithPleiades.length} (${((total / ampWithPleiades.length) * 100).toFixed(0)}%)`,
  )
  console.log(`    Output: ${ampOutPath}\n`)
}

// --- Building enrichment ---

async function enrichBuildings(): Promise<void> {
  console.log('Processing buildings...')

  const buildPath = fileURLToPath(new URL('../src/data/buildings/buildings.json', import.meta.url))
  const buildings: Building[] = JSON.parse(await readFile(buildPath, 'utf-8'))
  const buildWithPleiades = buildings
    .filter((b) => b.source === 'Pleiades')
    .map((b) => ({ entityId: b.id, pleiadesId: b.id, name: b.name, buildingType: b.buildingType }))

  console.log(`  Total: ${buildings.length}, Pleiades-sourced: ${buildWithPleiades.length}`)

  const buildOutPath = fileURLToPath(
    new URL('../src/data/wiki/buildings-wiki.json', import.meta.url),
  )
  const existing = await loadExistingOutput(buildOutPath)

  // For buildings: validate article is about the correct building type
  // But since there are 7768, we can't do fallback searches for all — just validate Pleiades results
  const result: WikiLookup = {}
  let kept = 0
  let rejected = 0

  // Check existing enrichments for relevance
  for (const b of buildWithPleiades) {
    const entry = existing[b.entityId]
    if (!entry) continue

    // Re-validate: does the extract mention the building type?
    const text = (entry.extract || '').toLowerCase()
    const title = (entry.wikiTitle || '').toLowerCase()
    const combined = text + ' ' + title

    const keywords = BUILDING_TYPE_KEYWORDS[b.buildingType]
    const isRelevant = keywords
      ? keywords.some((kw) => combined.includes(kw))
      : combined.includes('roman') || combined.includes('ancient')

    if (isRelevant) {
      result[b.entityId] = entry
      kept++
    } else {
      rejected++
    }
  }

  // Now process items that weren't in existing at all
  const unprocessed = buildWithPleiades.filter((b) => !existing[b.entityId])
  if (unprocessed.length > 0) {
    console.log(`  New items to process via SPARQL: ${unprocessed.length}`)
    const pleiadesMatches = await resolvePleiadesViaSparql(unprocessed)

    let newHits = 0
    let newMissed = 0
    let newRejected = 0

    for (const b of unprocessed) {
      const match = pleiadesMatches.get(b.pleiadesId)
      if (!match) {
        newMissed++
        continue
      }

      const title = extractTitleFromUrl(match.articleUrl)
      if (!title) {
        newMissed++
        continue
      }

      const summary = await fetchWikiSummary(title)
      if (!summary) {
        newMissed++
        continue
      }

      if (isBuildingArticleRelevant(summary, b.buildingType)) {
        result[b.entityId] = buildEnrichment(summary, 'pleiades', 0.85, match.wikidataId)
        newHits++
      } else {
        newRejected++
      }
    }

    console.log(`    New: ${newHits} kept, ${newRejected} rejected, ${newMissed} missed`)
    rejected += newRejected
  }

  await writeFile(buildOutPath, JSON.stringify(result, null, 2) + '\n')

  console.log(`\n  Results:`)
  console.log(`    Kept from existing (relevant): ${kept}`)
  console.log(`    Rejected (irrelevant article): ${rejected}`)
  console.log(`    Total enriched: ${Object.keys(result).length}`)
  console.log(`    Output: ${buildOutPath}\n`)
}

async function main() {
  console.log('Script B: Enriching via Pleiades IDs (with relevance validation)...\n')

  const outDir = fileURLToPath(new URL('../src/data/wiki', import.meta.url))
  await mkdir(outDir, { recursive: true })

  await enrichAmphitheaters()
  await enrichBuildings()

  console.log('Done.')
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
