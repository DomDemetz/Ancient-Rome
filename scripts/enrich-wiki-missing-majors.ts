/**
 * Targeted enrichment for major settlements missing wiki data.
 * Uses Wikidata QID → English Wikipedia sitelink → summary API.
 * Falls back to name-search for settlements without a QID.
 *
 * Saves incrementally after each match to survive rate-limit crashes.
 *
 * Usage: npx tsx scripts/enrich-wiki-missing-majors.ts
 */

import { readFile, writeFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import {
  rateLimitedFetch,
  fetchWikiSummary,
  searchWikidata,
  buildEnrichment,
  loadExistingOutput,
  haversineDistance,
  type WikiLookup,
} from './lib/wiki-api'

interface Place {
  id: string
  name: string
  lat: number
  lng: number
  dare?: { id: string; major?: boolean }
  qid?: string
  pid?: string
  wiki?: [string, string]
}

async function getWikiTitleFromQid(qid: string): Promise<string | null> {
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=sitelinks&sitefilter=enwiki&format=json`
  try {
    const res = await rateLimitedFetch(url, 500)
    if (!res.ok) return null
    const data = (await res.json()) as {
      entities: Record<string, { sitelinks?: { enwiki?: { title: string } } }>
    }
    return data.entities[qid]?.sitelinks?.enwiki?.title ?? null
  } catch {
    return null
  }
}

async function getWikidataCoords(qid: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=claims&format=json`
  try {
    const res = await rateLimitedFetch(url, 500)
    if (!res.ok) return null
    const data = (await res.json()) as {
      entities: Record<
        string,
        {
          claims?: Record<
            string,
            Array<{
              mainsnak?: {
                datavalue?: { value?: { latitude: number; longitude: number } }
              }
            }>
          >
        }
      >
    }
    const claims = data.entities[qid]?.claims?.P625
    if (!claims?.length) return null
    const val = claims[0]?.mainsnak?.datavalue?.value
    if (!val) return null
    return { lat: val.latitude, lng: val.longitude }
  } catch {
    return null
  }
}

async function main() {
  const placesPath = fileURLToPath(new URL('../src/data/places/places.json', import.meta.url))
  const places: Place[] = JSON.parse(await readFile(placesPath, 'utf-8'))

  const outPath = fileURLToPath(new URL('../src/data/wiki/settlements-wiki.json', import.meta.url))
  const result: WikiLookup = await loadExistingOutput(outPath)

  const missing = places.filter((p) => p.dare?.major && !p.wiki && p.dare?.id && !result[p.dare.id])
  console.log(`Major settlements without wiki: ${missing.length}`)

  let success = 0
  let failed = 0

  for (const p of missing) {
    const dareId = p.dare!.id
    console.log(`\n[${success + failed + 1}/${missing.length}] ${p.name} (dare:${dareId})`)

    // Strategy 1: QID → English Wikipedia sitelink with coordinate validation
    if (p.qid) {
      console.log(`  QID: ${p.qid}`)
      const title = await getWikiTitleFromQid(p.qid)
      if (title) {
        const coords = await getWikidataCoords(p.qid)
        if (coords) {
          const dist = haversineDistance(p.lat, p.lng, coords.lat, coords.lng)
          if (dist > 50) {
            console.log(`  ⚠ Coordinates too far (${dist.toFixed(0)}km), skipping QID path`)
          } else {
            const summary = await fetchWikiSummary(title)
            if (summary?.extract) {
              result[dareId] = buildEnrichment(summary, 'wikidata-search', 0.9, p.qid, 'settlement')
              console.log(`  ✓ ${title} (via QID, ${dist.toFixed(0)}km)`)
              success++
              await writeFile(outPath, JSON.stringify(result, null, 2))
              continue
            }
          }
        } else {
          console.log(`  No coordinates on Wikidata, skipping QID path (can't validate)`)
        }
      } else {
        console.log(`  No English Wikipedia article for ${p.qid}`)
      }
    }

    // Strategy 2: Wikidata entity search with coordinate validation
    try {
      const wdResults = await searchWikidata(p.name)
      let matched = false
      for (const wd of wdResults.slice(0, 3)) {
        const coords = await getWikidataCoords(wd.id)
        if (!coords) continue
        const dist = haversineDistance(p.lat, p.lng, coords.lat, coords.lng)
        if (dist > 50) continue

        const title = await getWikiTitleFromQid(wd.id)
        if (!title) continue

        const summary = await fetchWikiSummary(title)
        if (!summary?.extract) continue

        result[dareId] = buildEnrichment(
          summary,
          'wikidata-search',
          dist < 10 ? 0.85 : 0.7,
          wd.id,
          'settlement',
        )
        console.log(`  ✓ ${title} (via Wikidata search, ${dist.toFixed(0)}km)`)
        success++
        matched = true
        await writeFile(outPath, JSON.stringify(result, null, 2))
        break
      }

      if (!matched) {
        console.log(`  ✗ No match found`)
        failed++
      }
    } catch (err) {
      console.log(`  ✗ Error: ${(err as Error).message}`)
      failed++
      // Save what we have so far
      await writeFile(outPath, JSON.stringify(result, null, 2))
    }
  }

  // Final save
  await writeFile(outPath, JSON.stringify(result, null, 2))
  console.log(
    `\nDone: ${success} enriched, ${failed} failed, ${Object.keys(result).length} total entries`,
  )
}

main().catch(async (err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
