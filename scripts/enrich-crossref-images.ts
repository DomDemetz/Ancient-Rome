/**
 * Fetch Wikidata P18 (image) for cross-ref entries that have matching QIDs.
 * Adds an `imageUrl` field to cross-reference.json entries.
 *
 * Uses wbgetentities API with batches of 50 QIDs.
 * Converts Wikimedia Commons filenames to thumbnail URLs (300px wide).
 *
 * Usage: npx tsx scripts/enrich-crossref-images.ts
 */

import { readFile } from 'fs/promises'
import { writeJsonAtomic } from './lib/atomic-json.js'

const CR_PATH = 'src/data/wiki/cross-reference.json'
const PLACES_PATH = 'src/data/places/places.json'
const BATCH_SIZE = 50
const THUMB_WIDTH = 400

interface PlaceNode {
  id: string
  name: string
  qid?: string
  pid?: string
  dare?: { id: string }
}

interface CrossRefEntry {
  imageUrl?: string
  imageCaption?: string
  sources: string[]
  [key: string]: unknown
}

function commonsThumbUrl(filename: string, width: number): string {
  const name = filename.replace(/ /g, '_')
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=${width}`
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

async function fetchBatch(
  qids: string[],
): Promise<Map<string, { image: string; caption?: string }>> {
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qids.join('|')}&props=claims&format=json`
  const res = await fetchWithRetry(url)
  const data = await res.json()

  const results = new Map<string, { image: string; caption?: string }>()

  for (const [qid, entity] of Object.entries(data.entities || {})) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = entity as any
    if (e.missing) continue
    const p18 = e.claims?.P18
    if (!p18?.length) continue
    const filename = p18[0]?.mainsnak?.datavalue?.value
    if (!filename) continue
    results.set(qid, {
      image: commonsThumbUrl(filename, THUMB_WIDTH),
    })
  }

  return results
}

async function main() {
  const places: PlaceNode[] = JSON.parse(await readFile(PLACES_PATH, 'utf-8'))
  const crossRef: Record<string, CrossRefEntry> = JSON.parse(await readFile(CR_PATH, 'utf-8'))

  // Build QID → cross-ref key mapping
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
    if (keys.length) {
      keysByQid.set(p.qid, keys)
    }
  }

  // Filter out QIDs whose entries already have imageUrl
  const qidsToFetch: string[] = []
  for (const [qid, keys] of keysByQid) {
    const allHaveImage = keys.every((k) => crossRef[k]?.imageUrl)
    if (!allHaveImage) qidsToFetch.push(qid)
  }

  console.log(`Cross-ref entries: ${Object.keys(crossRef).length}`)
  console.log(`QIDs with cross-ref: ${keysByQid.size}`)
  console.log(`QIDs already with images: ${keysByQid.size - qidsToFetch.length}`)
  console.log(`QIDs to fetch: ${qidsToFetch.length}`)
  console.log(`Batches: ${Math.ceil(qidsToFetch.length / BATCH_SIZE)}`)
  console.log()

  let fetched = 0
  let imagesFound = 0

  for (let i = 0; i < qidsToFetch.length; i += BATCH_SIZE) {
    const batch = qidsToFetch.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(qidsToFetch.length / BATCH_SIZE)

    try {
      const results = await fetchBatch(batch)

      for (const [qid, img] of results) {
        const keys = keysByQid.get(qid) || []
        for (const key of keys) {
          if (crossRef[key]) {
            crossRef[key].imageUrl = img.image
          }
        }
        imagesFound++
      }

      fetched += batch.length
      if (batchNum % 10 === 0 || batchNum === totalBatches) {
        console.log(
          `[${batchNum}/${totalBatches}] Fetched ${fetched}/${qidsToFetch.length}, images found: ${imagesFound}`,
        )
      }

      // Save incrementally every 50 batches
      if (batchNum % 50 === 0) {
        await writeJsonAtomic(CR_PATH, crossRef, 2)
        console.log(`  (saved)`)
      }

      // Polite delay — Wikidata rate limit is ~200 req/min
      await new Promise((r) => setTimeout(r, 500))
    } catch (err) {
      console.error(`Batch ${batchNum} failed:`, err)
      // Save what we have
      await writeJsonAtomic(CR_PATH, crossRef, 2)
      console.log(`  (saved after error)`)
      await new Promise((r) => setTimeout(r, 5000))
    }
  }

  // Final save
  await writeJsonAtomic(CR_PATH, crossRef, 2)

  // Count results
  const entriesWithImage = Object.values(crossRef).filter((e) => e.imageUrl).length
  console.log()
  console.log(`Done. ${imagesFound} images found this run.`)
  console.log(
    `Total cross-ref entries with images: ${entriesWithImage}/${Object.keys(crossRef).length}`,
  )
}

main().catch(console.error)
