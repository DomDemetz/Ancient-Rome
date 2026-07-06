/**
 * Enrich buildings that already have QIDs with images and descriptions from Wikidata.
 * Only targets the ~891 buildings with known QIDs — no search needed.
 *
 * Usage: npx tsx scripts/enrich-building-images.ts
 */
import { readFile, writeFile } from 'fs/promises'

const CR_PATH = 'src/data/wiki/cross-reference.json'
const BUILDINGS_PATH = 'src/data/unified/building.json'

interface UnifiedEntity {
  id: string
  type: string
  name: string
  qid?: string
  [key: string]: unknown
}

interface CrossRefEntry {
  imageUrl?: string
  wikidataDescription?: string
  [key: string]: unknown
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchWithRetry(url: string, retries = 5): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const resp = await fetch(url, {
      headers: {
        'User-Agent':
          'AncientRomeAtlas/1.0 (https://github.com/DomDemetz/Ancient-Rome; jobs4you@fach-hr.com)',
        Accept: 'application/json',
      },
    })
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

async function getImageAndDesc(
  qids: string[],
): Promise<Record<string, { image?: string; desc?: string }>> {
  const ids = qids.join('|')
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids}&props=claims|descriptions&languages=en&format=json`
  const resp = await fetchWithRetry(url)
  const data = (await resp.json()) as {
    entities: Record<
      string,
      {
        claims?: { P18?: Array<{ mainsnak: { datavalue: { value: string } } }> }
        descriptions?: { en?: { value: string } }
      }
    >
  }

  const results: Record<string, { image?: string; desc?: string }> = {}
  for (const [qid, entity] of Object.entries(data.entities)) {
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
  const buildings: UnifiedEntity[] = JSON.parse(await readFile(BUILDINGS_PATH, 'utf-8'))
  const crossRef: Record<string, CrossRefEntry> = JSON.parse(await readFile(CR_PATH, 'utf-8'))

  const withQid = buildings.filter((b) => b.qid)
  console.log(`Buildings with QIDs: ${withQid.length} / ${buildings.length}`)

  let images = 0
  let descs = 0
  const batchSize = 5

  for (let i = 0; i < withQid.length; i += batchSize) {
    const batch = withQid.slice(i, i + batchSize)
    const qids = batch.map((b) => b.qid!).filter(Boolean)

    const enrichment = await getImageAndDesc(qids)
    await sleep(5000)

    for (const b of batch) {
      const crKey = `building:${stripPrefix(b.id)}`
      const entry = crossRef[crKey]
      if (!entry) continue

      const data = enrichment[b.qid!]
      if (data?.image && !entry.imageUrl) {
        entry.imageUrl = data.image
        images++
      }
      if (data?.desc && !entry.wikidataDescription) {
        entry.wikidataDescription = data.desc
        descs++
      }
    }

    console.log(
      `[${Math.min(i + batchSize, withQid.length)}/${withQid.length}] images: ${images}, descs: ${descs}`,
    )
  }

  await writeFile(CR_PATH, JSON.stringify(crossRef, null, 2) + '\n')
  console.log(`\nDone. ${images} images, ${descs} descriptions added.`)
}

main().catch(console.error)
