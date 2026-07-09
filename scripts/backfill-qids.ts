/**
 * Backfill QIDs for battles and amphitheaters via Wikidata search.
 * Saves QIDs to the source data files (battles.json, amphitheaters.json).
 * Also enriches cross-reference.json with images and descriptions.
 *
 * Usage: npx tsx scripts/backfill-qids.ts [battles|amphitheaters|all]
 */
import { readFile } from 'fs/promises'
import { writeJsonAtomic } from './lib/atomic-json.js'

const CR_PATH = 'src/data/wiki/cross-reference.json'

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
      process.stdout.write(`  429, ${delay / 1000}s...`)
      await sleep(delay)
      continue
    }
    return resp
  }
  throw new Error(`Failed after ${retries} retries`)
}

async function searchWikidata(
  name: string,
  typeHints: string[],
): Promise<{ qid: string; desc: string } | null> {
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&limit=5&format=json`
  const resp = await fetchWithRetry(url)
  const data = (await resp.json()) as {
    search: Array<{ id: string; description?: string }>
  }

  for (const result of data.search) {
    const desc = (result.description ?? '').toLowerCase()
    if (typeHints.some((h) => desc.includes(h))) {
      return { qid: result.id, desc: result.description ?? '' }
    }
  }
  return null
}

async function getImageForQids(
  qids: string[],
): Promise<Record<string, { image?: string; desc?: string }>> {
  if (qids.length === 0) return {}
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
    results[qid] = {
      image: imageFile
        ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageFile.replace(/ /g, '_'))}?width=400`
        : undefined,
      desc: entity.descriptions?.en?.value,
    }
  }
  return results
}

interface EntityConfig {
  dataPath: string
  crPrefix: string
  nameField: string
  typeHints: string[]
  searchVariants?: (name: string) => string[]
}

const CONFIGS: Record<string, EntityConfig> = {
  battles: {
    dataPath: 'src/data/battles/battles.json',
    crPrefix: 'battle',
    nameField: 'name',
    typeHints: ['battle', 'siege', 'military', 'war', 'conflict'],
  },
  amphitheaters: {
    dataPath: 'src/data/amphitheaters/amphitheaters.json',
    crPrefix: 'amphitheater',
    nameField: 'name',
    typeHints: ['amphitheat', 'roman', 'arena', 'colosseum', 'coliseum', 'ancient'],
    searchVariants: (name: string) => [`${name} amphitheatre`, `${name} amphitheater`, name],
  },
}

async function processEntityType(typeName: string) {
  const config = CONFIGS[typeName]
  if (!config) {
    console.log(`Unknown type: ${typeName}`)
    return
  }

  console.log(`\n=== Processing ${typeName} ===`)
  const entities = JSON.parse(await readFile(config.dataPath, 'utf-8'))
  const crossRef = JSON.parse(await readFile(CR_PATH, 'utf-8'))

  const needQid = entities.filter((e: Record<string, unknown>) => !e.qid)
  console.log(`Total: ${entities.length}, need QID: ${needQid.length}`)

  let found = 0
  let images = 0
  const batchSize = 10

  for (let i = 0; i < needQid.length; i += batchSize) {
    const batch = needQid.slice(i, i + batchSize)
    const qidResults = new Map<string, { qid: string; desc: string }>()

    for (const entity of batch) {
      const name = entity[config.nameField] as string
      const searchNames = config.searchVariants
        ? config.searchVariants(entity.city ?? name)
        : [name]

      for (const searchName of searchNames) {
        const result = await searchWikidata(searchName, config.typeHints)
        if (result) {
          qidResults.set(entity.id, result)
          entity.qid = result.qid
          found++
          break
        }
        await sleep(300)
      }
      await sleep(400)
    }

    if (qidResults.size > 0) {
      const qids = [...new Set([...qidResults.values()].map((r) => r.qid))]
      const enrichment = await getImageForQids(qids)
      await sleep(500)

      for (const [entityId, result] of qidResults) {
        const crKey = `${config.crPrefix}:${entityId}`
        const crEntry = crossRef[crKey]
        if (!crEntry) continue

        const data = enrichment[result.qid]
        if (data?.image && !crEntry.imageUrl) {
          crEntry.imageUrl = data.image
          images++
        }
        if (data?.desc && !crEntry.wikidataDescription) {
          crEntry.wikidataDescription = data.desc
        }
      }
    }

    const progress = Math.min(i + batchSize, needQid.length)
    console.log(`[${progress}/${needQid.length}] QIDs: ${found}, images: ${images}`)
  }

  await writeJsonAtomic(config.dataPath, entities, 2)
  await writeJsonAtomic(CR_PATH, crossRef, 2)
  console.log(`\n${typeName}: ${found} QIDs found, ${images} images added.`)
  console.log(
    `QID coverage: ${entities.filter((e: Record<string, unknown>) => e.qid).length}/${entities.length}`,
  )
}

async function main() {
  const target = process.argv[2] || 'all'

  if (target === 'all') {
    for (const typeName of Object.keys(CONFIGS)) {
      await processEntityType(typeName)
    }
  } else {
    await processEntityType(target)
  }
}

main().catch(console.error)
