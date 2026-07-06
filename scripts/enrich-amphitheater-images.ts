import { readFile, writeFile } from 'fs/promises'

const CR_PATH = 'src/data/wiki/cross-reference.json'
const AMPHS_PATH = 'src/data/amphitheaters/amphitheaters.json'

interface Amphitheater {
  id: string
  name: string
  city?: string
  lat: number
  lng: number
  capacity?: number
  dimensions?: string
  constructionYear?: number
}

interface CrossRefEntry {
  imageUrl?: string
  wikidataDescription?: string
  [key: string]: unknown
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

const HEADERS = {
  'User-Agent':
    'AncientRomeAtlas/1.0 (https://github.com/DomDemetz/Ancient-Rome; jobs4you@fach-hr.com)',
  Accept: 'application/json',
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

async function searchWikidata(name: string): Promise<string | null> {
  const searchTerms = [`${name} amphitheatre`, `${name} amphitheater`, name]

  for (const term of searchTerms) {
    const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(term)}&language=en&limit=5&format=json`
    const resp = await fetchWithRetry(url)
    const data = (await resp.json()) as {
      search: Array<{ id: string; label: string; description?: string }>
    }

    for (const result of data.search) {
      const desc = (result.description ?? '').toLowerCase()
      if (
        desc.includes('amphitheat') ||
        desc.includes('roman') ||
        desc.includes('arena') ||
        desc.includes('colosseum') ||
        desc.includes('coliseum')
      ) {
        return result.id
      }
    }
    await sleep(300)
  }
  return null
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

async function main() {
  const amphs: Amphitheater[] = JSON.parse(await readFile(AMPHS_PATH, 'utf-8'))
  const crossRef: Record<string, CrossRefEntry> = JSON.parse(await readFile(CR_PATH, 'utf-8'))

  let found = 0
  let images = 0
  let descs = 0

  const batchSize = 10

  for (let i = 0; i < amphs.length; i += batchSize) {
    const batch = amphs.slice(i, i + batchSize)
    const qidMap = new Map<string, string>()

    for (const a of batch) {
      const searchName = a.city ?? a.name
      const qid = await searchWikidata(searchName)
      if (qid) {
        qidMap.set(a.id, qid)
        found++
      }
      await sleep(500)
    }

    if (qidMap.size > 0) {
      const qids = [...new Set(qidMap.values())]
      const enrichment = await getImageAndDesc(qids)
      await sleep(500)

      for (const [amphId, qid] of qidMap) {
        const crKey = `amphitheater:${amphId}`
        const entry = crossRef[crKey]
        if (!entry) continue

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
    }

    console.log(
      `[${Math.min(i + batchSize, amphs.length)}/${amphs.length}] QIDs found: ${found}, images: ${images}, descs: ${descs}`,
    )
  }

  await writeFile(CR_PATH, JSON.stringify(crossRef, null, 2) + '\n')
  console.log(`\nDone. ${images} images, ${descs} descriptions added.`)
}

main().catch(console.error)
