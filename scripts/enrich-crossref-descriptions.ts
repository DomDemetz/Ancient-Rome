/**
 * Fetch Wikidata descriptions for cross-ref entries that have matching QIDs
 * but lack useful Pleiades descriptions (i.e., only have "An ancient place, cited:").
 *
 * Adds/improves the pleiadesDescription field in cross-reference.json.
 *
 * Usage: npx tsx scripts/enrich-crossref-descriptions.ts
 */

import { readFile, writeFile } from 'fs/promises'

const CR_PATH = 'src/data/wiki/cross-reference.json'
const PLACES_PATH = 'src/data/places/places.json'
const BATCH_SIZE = 50

interface PlaceNode {
  id: string
  name: string
  qid?: string
  pid?: string
  dare?: { id: string }
}

interface CrossRefEntry {
  pleiadesDescription?: string
  wikidataDescription?: string
  sources: string[]
  [key: string]: unknown
}

const HEADERS = {
  'User-Agent':
    'AncientRomeAtlas/1.0 (https://github.com/DomDemetz/Ancient-Rome; jobs4you@fach-hr.com)',
  Accept: 'application/json',
}

async function fetchWithRetry(url: string, retries = 5): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, { headers: HEADERS })
    if (res.status === 429) {
      const wait = Math.min(120, (i + 1) * 10)
      console.log(`  429 rate-limited, backing off ${wait}s...`)
      await new Promise((r) => setTimeout(r, wait * 1000))
      continue
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res
  }
  throw new Error('Max retries exceeded')
}

async function fetchBatch(qids: string[]): Promise<Map<string, string>> {
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qids.join('|')}&props=descriptions&languages=en&format=json`
  const res = await fetchWithRetry(url)
  const data = await res.json()

  const results = new Map<string, string>()
  for (const [qid, entity] of Object.entries(data.entities || {})) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = entity as any
    if (e.missing) continue
    const desc = e.descriptions?.en?.value
    if (desc && desc.length > 5) {
      results.set(qid, desc)
    }
  }
  return results
}

async function main() {
  const places: PlaceNode[] = JSON.parse(await readFile(PLACES_PATH, 'utf-8'))
  const crossRef: Record<string, CrossRefEntry> = JSON.parse(await readFile(CR_PATH, 'utf-8'))

  const keysByQid = new Map<string, string[]>()
  for (const p of places) {
    if (!p.qid) continue
    const keys: string[] = []
    if (p.dare?.id && crossRef[`settlement:${p.dare.id}`]) {
      keys.push(`settlement:${p.dare.id}`)
    }
    if (p.pid && crossRef[`pleiades:${p.pid}`]) {
      keys.push(`pleiades:${p.pid}`)
    }
    if (keys.length) keysByQid.set(p.qid, keys)
  }

  // Only fetch for entries that have cite-only or missing descriptions
  const qidsToFetch: string[] = []
  for (const [qid, keys] of keysByQid) {
    const needsDesc = keys.some((k) => {
      const entry = crossRef[k]
      if (!entry) return false
      if (entry.wikidataDescription) return false
      const desc = entry.pleiadesDescription
      return !desc || desc.startsWith('An ancient place, cited:')
    })
    if (needsDesc) qidsToFetch.push(qid)
  }

  console.log(`QIDs with cross-ref: ${keysByQid.size}`)
  console.log(`QIDs needing descriptions: ${qidsToFetch.length}`)
  console.log(`Batches: ${Math.ceil(qidsToFetch.length / BATCH_SIZE)}`)
  console.log()

  let fetched = 0
  let descsFound = 0

  for (let i = 0; i < qidsToFetch.length; i += BATCH_SIZE) {
    const batch = qidsToFetch.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(qidsToFetch.length / BATCH_SIZE)

    try {
      const results = await fetchBatch(batch)

      for (const [qid, desc] of results) {
        const keys = keysByQid.get(qid) || []
        for (const key of keys) {
          if (crossRef[key]) {
            crossRef[key].wikidataDescription = desc
          }
        }
        descsFound++
      }

      fetched += batch.length
      if (batchNum % 10 === 0 || batchNum === totalBatches) {
        console.log(
          `[${batchNum}/${totalBatches}] Fetched ${fetched}/${qidsToFetch.length}, descriptions found: ${descsFound}`,
        )
      }

      if (batchNum % 50 === 0) {
        await writeFile(CR_PATH, JSON.stringify(crossRef, null, 2) + '\n')
        console.log(`  (saved)`)
      }

      await new Promise((r) => setTimeout(r, 500))
    } catch (err) {
      console.error(`Batch ${batchNum} failed:`, err)
      await writeFile(CR_PATH, JSON.stringify(crossRef, null, 2) + '\n')
      console.log(`  (saved after error)`)
      await new Promise((r) => setTimeout(r, 10000))
    }
  }

  await writeFile(CR_PATH, JSON.stringify(crossRef, null, 2) + '\n')

  const withDesc = Object.values(crossRef).filter((e) => e.wikidataDescription).length
  console.log()
  console.log(`Done. ${descsFound} descriptions found this run.`)
  console.log(
    `Total entries with Wikidata description: ${withDesc}/${Object.keys(crossRef).length}`,
  )
}

main().catch(console.error)
