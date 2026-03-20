/**
 * Script C: Fuzzy-match battles and major settlements to Wikipedia.
 *
 * - Battles: Wikipedia opensearch + year validation
 * - Settlements: Wikidata entity search + coordinate validation (50km)
 *
 * Usage: npx tsx scripts/enrich-wikipedia-fuzzy.ts
 */

import { writeFile, readFile, mkdir } from 'fs/promises'
import { fileURLToPath } from 'url'
import {
  searchWikipedia,
  searchWikidata,
  fetchWikiSummary,
  buildEnrichment,
  loadExistingOutput,
  haversineDistance,
  rateLimitedFetch,
  type WikiLookup,
} from './lib/wiki-api'

// --- Battles ---

interface Battle {
  id: string
  name: string
  year: number
  lat: number
  lng: number
}

async function enrichBattles(): Promise<WikiLookup> {
  console.log('Processing battles...')

  const battlesPath = fileURLToPath(new URL('../src/data/battles/battles.json', import.meta.url))
  const battles: Battle[] = JSON.parse(await readFile(battlesPath, 'utf-8'))

  const outPath = fileURLToPath(new URL('../src/data/wiki/battles-wiki.json', import.meta.url))
  const existing = await loadExistingOutput(outPath)
  const result: WikiLookup = { ...existing }

  const toProcess = battles.filter((b) => !result[b.id])
  console.log(`  Total battles: ${battles.length}, to process: ${toProcess.length}`)

  let success = 0
  let missed = 0

  for (const battle of toProcess) {
    // Try opensearch with "Battle of {name}"
    const searchTerm = `Battle of ${battle.name}`
    const titles = await searchWikipedia(searchTerm)

    let matched = false
    for (const title of titles.slice(0, 3)) {
      const summary = await fetchWikiSummary(title)
      if (!summary?.extract) continue

      // Validate: check if the article mentions a year within +/-20 of the battle's year
      const yearPattern = /\b(\d{1,4})\s*(BC|AD|BCE|CE)\b/gi
      let yearMatch: RegExpExecArray | null
      let yearValid = false

      while ((yearMatch = yearPattern.exec(summary.extract)) !== null) {
        let articleYear = parseInt(yearMatch[1], 10)
        if (yearMatch[2] === 'BC' || yearMatch[2] === 'BCE') articleYear = -articleYear
        if (Math.abs(articleYear - battle.year) <= 20) {
          yearValid = true
          break
        }
      }

      if (yearValid) {
        result[battle.id] = buildEnrichment(summary, 'name-search', 0.85)
        success++
        matched = true
        break
      }
    }

    if (!matched) {
      // Fallback: try just the battle name without "Battle of"
      const fallbackTitles = await searchWikipedia(battle.name)
      for (const title of fallbackTitles.slice(0, 2)) {
        if (!title.toLowerCase().includes('battle')) continue
        const summary = await fetchWikiSummary(title)
        if (summary?.extract) {
          result[battle.id] = buildEnrichment(summary, 'name-search', 0.6)
          success++
          matched = true
          break
        }
      }
    }

    if (!matched) missed++

    if ((success + missed) % 20 === 0) {
      console.log(`  Progress: ${success} matched, ${missed} missed of ${success + missed}`)
    }
  }

  await writeFile(outPath, JSON.stringify(result, null, 2) + '\n')
  console.log(`  Results: ${success} new matches, ${missed} missed`)
  console.log(`  Total: ${Object.keys(result).length} entries\n`)

  return result
}

// --- Settlements ---

interface Settlement {
  id: string
  name: string
  modern: string
  lat: number
  lng: number
  major: boolean
}

async function getWikidataCoords(wikidataId: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${wikidataId}&property=P625&format=json`

  try {
    const res = await rateLimitedFetch(url, 200)
    if (!res.ok) return null
    const data = (await res.json()) as {
      claims: {
        P625?: { mainsnak: { datavalue: { value: { latitude: number; longitude: number } } } }[]
      }
    }
    const coords = data.claims?.P625?.[0]?.mainsnak?.datavalue?.value
    if (!coords) return null
    return { lat: coords.latitude, lng: coords.longitude }
  } catch {
    return null
  }
}

async function enrichSettlements(): Promise<WikiLookup> {
  console.log('Processing settlements...')

  const settlementsPath = fileURLToPath(
    new URL('../src/data/dare/settlements.json', import.meta.url),
  )
  const allSettlements: Settlement[] = JSON.parse(await readFile(settlementsPath, 'utf-8'))

  // Filter to major settlements with non-empty names
  const settlements = allSettlements.filter((s) => s.major && s.name.trim())

  // Check for already-enriched entity IDs (from Script A)
  const entitiesOutPath = fileURLToPath(
    new URL('../src/data/wiki/entities-wiki.json', import.meta.url),
  )
  const entityWiki = await loadExistingOutput(entitiesOutPath)

  const outPath = fileURLToPath(new URL('../src/data/wiki/settlements-wiki.json', import.meta.url))
  const existing = await loadExistingOutput(outPath)
  const result: WikiLookup = { ...existing }

  const toProcess = settlements.filter((s) => !result[s.id] && !entityWiki[s.id])
  console.log(`  Major settlements: ${settlements.length}, to process: ${toProcess.length}`)

  let success = 0
  let missed = 0

  for (const settlement of toProcess) {
    let matched = false

    // Step 1: Wikidata entity search with ancient name
    const wdResults = await searchWikidata(settlement.name)

    for (const wd of wdResults.slice(0, 3)) {
      // Validate coordinates
      const coords = await getWikidataCoords(wd.id)
      if (!coords) continue

      const dist = haversineDistance(settlement.lat, settlement.lng, coords.lat, coords.lng)
      if (dist > 50) continue // Must be within 50km

      // Get Wikipedia article via sitelink
      const sitelinkUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${wd.id}&props=sitelinks&sitefilter=enwiki&format=json`
      try {
        const slRes = await rateLimitedFetch(sitelinkUrl, 200)
        if (!slRes.ok) continue
        const slData = (await slRes.json()) as {
          entities: Record<string, { sitelinks?: { enwiki?: { title: string } } }>
        }
        const title = slData.entities[wd.id]?.sitelinks?.enwiki?.title
        if (!title) continue

        const summary = await fetchWikiSummary(title)
        if (!summary?.extract) continue

        const confidence = dist < 10 ? 0.9 : dist < 25 ? 0.8 : 0.7
        result[settlement.id] = buildEnrichment(summary, 'wikidata-search', confidence, wd.id)
        success++
        matched = true
        break
      } catch {
        continue
      }
    }

    // Step 2: Fallback to modern name
    if (!matched && settlement.modern && settlement.modern !== settlement.name) {
      const modernResults = await searchWikidata(settlement.modern)
      for (const wd of modernResults.slice(0, 2)) {
        const coords = await getWikidataCoords(wd.id)
        if (!coords) continue

        const dist = haversineDistance(settlement.lat, settlement.lng, coords.lat, coords.lng)
        if (dist > 50) continue

        const sitelinkUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${wd.id}&props=sitelinks&sitefilter=enwiki&format=json`
        try {
          const slRes = await rateLimitedFetch(sitelinkUrl, 200)
          if (!slRes.ok) continue
          const slData = (await slRes.json()) as {
            entities: Record<string, { sitelinks?: { enwiki?: { title: string } } }>
          }
          const title = slData.entities[wd.id]?.sitelinks?.enwiki?.title
          if (!title) continue

          const summary = await fetchWikiSummary(title)
          if (!summary?.extract) continue

          const confidence = dist < 10 ? 0.8 : 0.65
          result[settlement.id] = buildEnrichment(summary, 'wikidata-search', confidence, wd.id)
          success++
          matched = true
          break
        } catch {
          continue
        }
      }
    }

    if (!matched) missed++

    if ((success + missed) % 50 === 0) {
      console.log(`  Progress: ${success} matched, ${missed} missed of ${success + missed}`)
      // Checkpoint save
      await writeFile(outPath, JSON.stringify(result, null, 2) + '\n')
    }
  }

  await writeFile(outPath, JSON.stringify(result, null, 2) + '\n')
  console.log(`  Results: ${success} new matches, ${missed} missed`)
  console.log(`  Total: ${Object.keys(result).length} entries\n`)

  return result
}

async function main() {
  console.log('Script C: Fuzzy Wikipedia enrichment...\n')

  const outDir = fileURLToPath(new URL('../src/data/wiki', import.meta.url))
  await mkdir(outDir, { recursive: true })

  await enrichBattles()
  await enrichSettlements()

  console.log('Done.')
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
