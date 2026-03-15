/**
 * Script to fetch and process archaeological site data from iDAI.gazetteer
 * (German Archaeological Institute).
 *
 * Source: https://gazetteer.dainst.org
 * API docs: https://gazetteer.dainst.org/app/#!/about
 *
 * Usage: npx tsx scripts/ingest-idai.ts
 */

import { writeFile } from 'fs/promises'
import { fileURLToPath } from 'url'

const BASE_URL = 'https://gazetteer.dainst.org/search.json'
const PAGE_LIMIT = 100
const MAX_RESULTS = 10_000

// Bounding box for the Roman world
const LAT_MIN = 20
const LAT_MAX = 60
const LNG_MIN = -15
const LNG_MAX = 50

interface IDAILocation {
  coordinates: [number, number] // [lng, lat] in GeoJSON order
  confidence?: number
  publicSite?: boolean
}

interface IDAIName {
  title: string
  language?: string
}

interface IDAIResult {
  gazId: string
  prefName?: IDAIName
  names?: IDAIName[]
  prefLocation?: IDAILocation
  types?: string[]
  tags?: string[]
}

interface IDAISearchResponse {
  total: number
  result: IDAIResult[]
}

interface Site {
  id: string
  name: string
  lat: number
  lng: number
  siteType: string
  description: string
  startYear: number
  endYear: number
  source: string
}

function truncateCoord(n: number): number {
  return Math.round(n * 10000) / 10000
}

function isInRomanWorld(lat: number, lng: number): boolean {
  return lat >= LAT_MIN && lat <= LAT_MAX && lng >= LNG_MIN && lng <= LNG_MAX
}

async function fetchPage(
  query: string,
  filterQueries: string[],
  offset: number,
): Promise<IDAISearchResponse | null> {
  const params = new URLSearchParams()
  params.set('q', query)
  for (const fq of filterQueries) {
    params.append('fq', fq)
  }
  params.set('limit', String(PAGE_LIMIT))
  params.set('offset', String(offset))

  const url = `${BASE_URL}?${params.toString()}`

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    })
    if (!res.ok) {
      console.log(`  HTTP ${res.status} for offset=${offset}`)
      return null
    }
    return (await res.json()) as IDAISearchResponse
  } catch (err) {
    console.log(`  Fetch error at offset=${offset}: ${(err as Error).message}`)
    return null
  }
}

async function fetchAllPages(
  label: string,
  query: string,
  filterQueries: string[],
): Promise<IDAIResult[]> {
  console.log(`\nFetching: ${label}`)
  console.log(`  Query: q=${query}, fq=${filterQueries.join(', ')}`)

  const firstPage = await fetchPage(query, filterQueries, 0)
  if (!firstPage) {
    console.log('  First page failed, skipping this query.')
    return []
  }

  const total = Math.min(firstPage.total, MAX_RESULTS)
  console.log(`  Total available: ${firstPage.total} (fetching up to ${total})`)

  const allResults: IDAIResult[] = [...firstPage.result]

  let offset = PAGE_LIMIT
  while (offset < total) {
    const page = await fetchPage(query, filterQueries, offset)
    if (!page || page.result.length === 0) break
    allResults.push(...page.result)
    offset += PAGE_LIMIT
    if (offset % 500 === 0) {
      console.log(`  Fetched ${allResults.length} / ${total}...`)
    }
  }

  console.log(`  Fetched ${allResults.length} results.`)
  return allResults
}

function convertResult(result: IDAIResult): Site | null {
  const loc = result.prefLocation
  if (!loc || !loc.coordinates || loc.coordinates.length < 2) return null

  // Coordinates are [lng, lat] in GeoJSON order
  const lng = truncateCoord(loc.coordinates[0])
  const lat = truncateCoord(loc.coordinates[1])

  if (!isInRomanWorld(lat, lng)) return null

  const name = result.prefName?.title
  if (!name) return null

  const siteType = result.types && result.types.length > 0 ? result.types[0] : 'archaeological-site'

  return {
    id: `idai-${result.gazId}`,
    name,
    lat,
    lng,
    siteType,
    description: '',
    startYear: 0,
    endYear: 0,
    source: 'iDAI.gazetteer',
  }
}

async function main() {
  console.log('Ingesting archaeological site data from iDAI.gazetteer...\n')

  // Try multiple query strategies to get Roman-related sites
  const queries: { label: string; query: string; fq: string[] }[] = [
    {
      label: 'Archaeological sites with Roman tag',
      query: '*',
      fq: ['types:archaeological-site', 'tags:roman'],
    },
    {
      label: 'Archaeological sites with römisch tag',
      query: '*',
      fq: ['types:archaeological-site', 'tags:römisch'],
    },
    {
      label: 'Search for "roman" archaeological sites',
      query: 'roman',
      fq: ['types:archaeological-site'],
    },
    {
      label: 'Search for "roma" archaeological sites',
      query: 'roma',
      fq: ['types:archaeological-site'],
    },
    {
      label: 'All archaeological sites (broad)',
      query: '*',
      fq: ['types:archaeological-site'],
    },
  ]

  const allRaw: IDAIResult[] = []

  for (const { label, query, fq } of queries) {
    const results = await fetchAllPages(label, query, fq)
    allRaw.push(...results)

    // If we already got a good amount of results, we can be selective
    if (allRaw.length >= MAX_RESULTS) {
      console.log(`\nReached ${MAX_RESULTS} raw results, stopping queries.`)
      break
    }
  }

  if (allRaw.length === 0) {
    console.log('\nAPI returned no results or is unavailable. Writing empty array.')
    const outPath = fileURLToPath(new URL('../src/data/idai-sites.json', import.meta.url))
    await writeFile(outPath, '[]\n')
    console.log(`Output: ${outPath}`)
    return
  }

  // Deduplicate by gazId
  const seenGazIds = new Set<string>()
  const sites: Site[] = []

  for (const raw of allRaw) {
    if (seenGazIds.has(raw.gazId)) continue
    seenGazIds.add(raw.gazId)

    const site = convertResult(raw)
    if (site) sites.push(site)
  }

  // Sort by name
  sites.sort((a, b) => a.name.localeCompare(b.name))

  const outPath = fileURLToPath(new URL('../src/data/idai-sites.json', import.meta.url))
  const json = JSON.stringify(sites, null, 2)
  await writeFile(outPath, json + '\n')

  // Collect site type stats
  const typeCounts: Record<string, number> = {}
  for (const s of sites) {
    typeCounts[s.siteType] = (typeCounts[s.siteType] || 0) + 1
  }

  console.log(`\nResults:`)
  console.log(`  Raw results fetched: ${allRaw.length}`)
  console.log(`  Unique gazetteer IDs: ${seenGazIds.size}`)
  console.log(`  Sites with coordinates in Roman world: ${sites.length}`)
  console.log(`  Output: ${outPath} (${(json.length / 1024).toFixed(0)} KB)`)
  console.log(`\nSite types:`)
  for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`)
  }

  console.log(`\nSample entries:`)
  for (const s of sites.slice(0, 5)) {
    console.log(`  ${s.name} (${s.lat}, ${s.lng}) [${s.siteType}]`)
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
