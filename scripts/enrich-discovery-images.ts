/**
 * Enrich discovery entities (tombs, villas, temples, bridges) with Wikidata images/descriptions.
 * Creates cross-reference entries if they don't exist, then enriches with P18 images and descriptions.
 *
 * Usage: npx tsx scripts/enrich-discovery-images.ts
 */
import { readFile } from 'fs/promises'
import { writeJsonAtomic } from './lib/atomic-json.js'

const CR_PATH = 'src/data/wiki/cross-reference.json'
const UNIFIED_DIR = 'src/data/unified'

const DISCOVERY_TYPES = [
  'discovery-tomb',
  'discovery-villa',
  'discovery-temple',
  'discovery-bridge',
] as const

interface UnifiedEntity {
  id: string
  type: string
  name: string
  qid?: unknown
  lat: number
  lng: number
  [key: string]: unknown
}

interface CrossRefEntry {
  imageUrl?: string
  wikidataDescription?: string
  [key: string]: unknown
}

const HEADERS = {
  'User-Agent':
    'AncientRomeAtlas/1.0 (https://github.com/DomDemetz/Ancient-Rome; jobs4you@fach-hr.com)',
  Accept: 'application/json',
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchWithRetry(url: string, retries = 5): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const resp = await fetch(url, { headers: HEADERS })
    if (resp.status === 429) {
      const delay = 10_000 * (i + 1)
      console.log(`  429 rate-limited, backing off ${delay / 1000}s...`)
      await sleep(delay)
      continue
    }
    return resp
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

function extractQid(qid: unknown): string | null {
  if (typeof qid === 'string') {
    const match = qid.match(/^(Q\d+)/)
    return match ? match[1] : null
  }
  if (qid && typeof qid === 'object' && 'qid' in qid) return (qid as { qid: string }).qid
  return null
}

async function getImageAndDesc(
  qids: string[],
): Promise<Record<string, { image?: string; desc?: string }>> {
  const ids = qids.join('|')
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids}&props=claims|descriptions&languages=en&format=json`
  const resp = await fetchWithRetry(url)
  const data = (await resp.json()) as {
    entities?: Record<
      string,
      {
        claims?: { P18?: Array<{ mainsnak: { datavalue: { value: string } } }> }
        descriptions?: { en?: { value: string } }
      }
    >
  }

  const results: Record<string, { image?: string; desc?: string }> = {}
  if (!data.entities) return results
  for (const [qid, entity] of Object.entries(data.entities)) {
    if (!entity) continue
    const imageFile = entity.claims?.P18?.[0]?.mainsnak?.datavalue?.value
    const desc = entity.descriptions?.en?.value
    results[qid] = {
      image: imageFile
        ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageFile.replace(/ /g, '_'))}?width=400`
        : undefined,
      desc,
    }
  }
  return results
}

function stripPrefix(id: string): string {
  const i = id.indexOf(':')
  return i >= 0 ? id.slice(i + 1) : id
}

async function main() {
  const crossRef: Record<string, CrossRefEntry> = JSON.parse(await readFile(CR_PATH, 'utf-8'))

  let totalImages = 0
  let totalDescs = 0
  let totalCreated = 0

  for (const type of DISCOVERY_TYPES) {
    const path = `${UNIFIED_DIR}/${type}.json`
    let entities: UnifiedEntity[]
    try {
      entities = JSON.parse(await readFile(path, 'utf-8'))
    } catch {
      console.log(`Skipping ${type}: file not found`)
      continue
    }

    const withQid = entities.filter((e) => extractQid(e.qid) !== null)
    console.log(`\n${type}: ${withQid.length} with QIDs / ${entities.length} total`)

    let images = 0
    let descs = 0
    let created = 0
    const batchSize = 5

    for (let i = 0; i < withQid.length; i += batchSize) {
      const batch = withQid.slice(i, i + batchSize)
      const qids = batch.map((e) => extractQid(e.qid)).filter((q): q is string => q !== null)
      if (!qids.length) continue

      const enrichment = await getImageAndDesc(qids)
      await sleep(5000)

      for (const e of batch) {
        const crKey = `${type}:${stripPrefix(e.id)}`
        if (!crossRef[crKey]) {
          crossRef[crKey] = { name: e.name }
          created++
        }
        const entry = crossRef[crKey]

        const qid = extractQid(e.qid)
        if (!qid) continue
        const data = enrichment[qid]
        if (data?.image && !entry.imageUrl) {
          entry.imageUrl = data.image
          images++
        }
        if (data?.desc && !entry.wikidataDescription) {
          entry.wikidataDescription = data.desc
          descs++
        }
      }

      const progress = Math.min(i + batchSize, withQid.length)
      console.log(
        `  [${progress}/${withQid.length}] images: ${images}, descs: ${descs}, new entries: ${created}`,
      )

      if (progress % 50 === 0 || progress === withQid.length) {
        await writeJsonAtomic(CR_PATH, crossRef, 2)
      }
    }

    await writeJsonAtomic(CR_PATH, crossRef, 2)
    console.log(`  Done: ${images} images, ${descs} descriptions, ${created} new entries`)
    totalImages += images
    totalDescs += descs
    totalCreated += created
  }

  console.log(
    `\nTotal: ${totalImages} images, ${totalDescs} descriptions, ${totalCreated} new entries`,
  )
}

main().catch(console.error)
