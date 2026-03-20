/**
 * Shared Wikipedia/Wikidata API utilities for enrichment scripts.
 */

import { readFile } from 'fs/promises'

const USER_AGENT = 'AncientRomeMap/1.0 (https://github.com/ancient-rome-map; contact@example.com)'

// --- Rate limiting ---

let lastFetchTime = 0
let rateLimitCooldownUntil = 0

export async function rateLimitedFetch(url: string, delayMs = 50): Promise<Response> {
  // If we recently hit a 429, wait for the cooldown to pass
  const cooldownRemaining = rateLimitCooldownUntil - Date.now()
  if (cooldownRemaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, cooldownRemaining))
  }

  const now = Date.now()
  const elapsed = now - lastFetchTime
  if (elapsed < delayMs) {
    await new Promise((resolve) => setTimeout(resolve, delayMs - elapsed))
  }
  lastFetchTime = Date.now()

  let lastError: Error | null = null
  const delays = [2000, 10000, 60000]

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      })

      if (res.status === 429) {
        if (attempt < delays.length) {
          const backoff = delays[attempt]
          console.warn(`  429 rate-limited, backing off ${backoff / 1000}s...`)
          rateLimitCooldownUntil = Date.now() + backoff
          await new Promise((resolve) => setTimeout(resolve, backoff))
          continue
        }
        throw new Error(`Rate limited after ${delays.length} retries: ${url}`)
      }

      return res
    } catch (err) {
      lastError = err as Error
      if (attempt < delays.length) {
        console.warn(`  Fetch error (attempt ${attempt + 1}): ${lastError.message}, retrying...`)
        await new Promise((resolve) => setTimeout(resolve, delays[attempt]))
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch: ${url}`)
}

// --- Wikipedia REST API ---

export interface WikiSummary {
  title: string
  extract: string
  description?: string
  thumbnail?: { source: string; width: number; height: number }
  content_urls?: { desktop: { page: string } }
}

export async function fetchWikiSummary(title: string): Promise<WikiSummary | null> {
  const encoded = encodeURIComponent(title.replace(/ /g, '_'))
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`

  try {
    const res = await rateLimitedFetch(url)
    if (!res.ok) {
      if (res.status === 404) return null
      console.warn(`  Wiki summary ${res.status} for "${title}"`)
      return null
    }
    return (await res.json()) as WikiSummary
  } catch (err) {
    console.warn(`  Wiki summary error for "${title}": ${(err as Error).message}`)
    return null
  }
}

// --- Wikidata SPARQL ---

export async function sparqlQuery(query: string): Promise<Record<string, unknown>[]> {
  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`

  const res = await rateLimitedFetch(url, 2000) // 2s between SPARQL queries
  if (!res.ok) {
    throw new Error(`SPARQL query failed: ${res.status} ${res.statusText}`)
  }

  const data = (await res.json()) as {
    results: { bindings: Record<string, { value: string }>[] }
  }
  return data.results.bindings.map((b) => {
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(b)) {
      result[key] = val.value
    }
    return result
  })
}

// --- Wikidata search ---

export interface WikidataSearchResult {
  id: string
  label: string
  description?: string
}

export async function searchWikidata(name: string): Promise<WikidataSearchResult[]> {
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&limit=5&format=json`

  try {
    const res = await rateLimitedFetch(url, 200)
    if (!res.ok) return []
    const data = (await res.json()) as {
      search: { id: string; label: string; description?: string }[]
    }
    return data.search.map((s) => ({
      id: s.id,
      label: s.label,
      description: s.description,
    }))
  } catch {
    return []
  }
}

// --- Wikipedia opensearch ---

export async function searchWikipedia(name: string): Promise<string[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(name)}&limit=5&format=json`

  try {
    const res = await rateLimitedFetch(url, 500)
    if (!res.ok) return []
    const data = (await res.json()) as [string, string[]]
    return data[1] ?? []
  } catch {
    return []
  }
}

// --- Roman-era content extraction ---

const ROMAN_KEYWORDS = [
  'roman',
  'rome',
  'empire',
  'republic',
  'legion',
  'province',
  'amphitheat',
  'forum',
  'consul',
  'emperor',
  'senate',
  'gladiat',
  'colosseum',
  'aqueduct',
  'caesar',
  'augustus',
  'imperial',
  'latin',
  'patrician',
  'plebeian',
  'tribune',
  'praetor',
  'centurion',
  'cohort',
  'basilica',
  'thermae',
  'circus maximus',
  'punic',
  'carthag',
  'colonia',
  'municipium',
  'ancient',
  'antiquity',
  'archaeology',
  'excavat',
  'artifact',
  'ruins',
]

/** Keywords that indicate a WRONG article (modern namesake, disambiguation) */
const WRONG_ARTICLE_SIGNALS = [
  /\bmay refer to\b/i, // disambiguation page
  /\bthis article is about\b/i, // hatnote
  /\b(concert|music|entertainment) venue\b/i, // modern amphitheater
  /\bwar of the pacific\b/i, // wrong-era battle
  /\bworld war (i|ii|1|2)\b/i, // wrong-era battle
  /\bnapoleon/i, // wrong-era battle
  /\bcivil war\b(?!.*roman)/i, // non-Roman civil war
  /\b(stadium|arena|center|centre)\b(?!.*roman|ancient)/i, // modern venue
]

const CENTURY_PATTERN = /\b\d{1,2}(st|nd|rd|th)\s+century\b/i
const BC_AD_PATTERN = /\b\d+\s*(BC|AD|BCE|CE)\b/i
/** Matches years in the Roman period range (roughly 800 BC to 600 AD) */
const ROMAN_ERA_YEAR_PATTERN = /\b([1-9]\d{0,2})\s*(BC|BCE)\b|\b([1-5]\d{0,2})\s*(AD|CE)\b/i

export function extractRomanContent(fullExtract: string): string {
  if (!fullExtract) return ''

  const paragraphs = fullExtract.split(/\n\n+/)
  const romanParagraphs = paragraphs.filter((p) => {
    const lower = p.toLowerCase()
    return (
      ROMAN_KEYWORDS.some((kw) => lower.includes(kw)) ||
      CENTURY_PATTERN.test(p) ||
      BC_AD_PATTERN.test(p)
    )
  })

  if (romanParagraphs.length > 0) {
    return romanParagraphs.slice(0, 3).join('\n\n')
  }

  // Fallback: first 300 chars
  return fullExtract.slice(0, 300) + (fullExtract.length > 300 ? '...' : '')
}

/**
 * Compute a Roman-era relevance score (0.0–1.0) for a Wikipedia extract.
 *
 * Returns:
 * - 0.0: definitely wrong article (disambiguation, modern namesake)
 * - 0.0–0.3: no Roman signals, probably a modern-city article
 * - 0.3–0.6: weak signals (mentions "Roman" once, or has a Latin name)
 * - 0.6–1.0: strong Roman content
 */
export function scoreRomanRelevance(extract: string, description?: string): number {
  if (!extract) return 0

  // Check for definite wrong-article signals
  const combined = extract + ' ' + (description ?? '')
  for (const pattern of WRONG_ARTICLE_SIGNALS) {
    if (pattern.test(combined)) return 0
  }

  const lower = extract.toLowerCase()
  const words = lower.split(/\s+/).length

  // Count keyword hits (unique keywords, not occurrences)
  const kwHits = ROMAN_KEYWORDS.filter((kw) => lower.includes(kw))

  // Count era signals
  const hasCentury = CENTURY_PATTERN.test(extract) ? 1 : 0
  const hasBcAd = BC_AD_PATTERN.test(extract) ? 1 : 0
  const hasRomanEraYear = ROMAN_ERA_YEAR_PATTERN.test(extract) ? 1 : 0

  // Keyword density (hits per 100 words)
  const density = words > 0 ? (kwHits.length / words) * 100 : 0

  // Weighted score
  let score = 0

  // Keyword count (max 0.5 from keywords)
  score += Math.min(kwHits.length * 0.1, 0.5)

  // Density bonus (max 0.2)
  score += Math.min(density * 0.05, 0.2)

  // Era signal bonus (max 0.3)
  score += hasCentury * 0.1
  score += hasBcAd * 0.1
  score += hasRomanEraYear * 0.1

  return Math.min(score, 1.0)
}

/**
 * Detect if a Wikipedia article is likely about the wrong thing entirely.
 * Returns a reason string if wrong, or null if it seems ok.
 */
export function detectWrongArticle(
  extract: string,
  expectedType?: 'battle' | 'amphitheater' | 'settlement' | 'building',
): string | null {
  if (!extract) return 'empty extract'

  // Disambiguation pages
  if (/\bmay refer to\b/i.test(extract) && extract.length < 500) {
    return 'disambiguation page'
  }

  // Modern amphitheaters
  if (expectedType === 'amphitheater') {
    if (
      /\b(concert|music|entertainment|performing arts)\b/i.test(extract) &&
      !/\b(roman|ancient|gladiat|amphitheat.*ruin)/i.test(extract)
    ) {
      return 'modern entertainment venue, not Roman amphitheater'
    }
  }

  // Wrong-era battles
  if (expectedType === 'battle') {
    if (
      /\b(world war|napoleonic|war of the pacific|crusade|ottoman)\b/i.test(extract) &&
      !/\broman\b/i.test(extract)
    ) {
      return 'wrong-era battle'
    }
  }

  return null
}

/**
 * Fetch the "History" section from a Wikipedia article.
 * The REST API summary only has the intro paragraph. For places like "Trier",
 * the Roman history is in a subsection. This fetches the full "History" section text.
 *
 * Returns null if no History section found or on error.
 */
export async function fetchWikiHistorySection(title: string): Promise<string | null> {
  const encoded = encodeURIComponent(title.replace(/ /g, '_'))

  // Step 1: Get mobile sections (lighter than full HTML parsing)
  const url = `https://en.wikipedia.org/api/rest_v1/page/mobile-sections/${encoded}`
  try {
    const res = await rateLimitedFetch(url, 100)
    if (!res.ok) return null

    const data = (await res.json()) as {
      remaining: { sections: Array<{ line: string; text: string; id: number }> }
    }

    // Look for "History", "Ancient history", "Roman period", "Roman era" sections
    const historyPatterns = [
      /^(ancient\s+)?history$/i,
      /^roman\s+(period|era|history|times)/i,
      /^antiquity$/i,
      /^(early\s+)?history\s+and\s+antiquity/i,
    ]

    for (const section of data.remaining?.sections ?? []) {
      if (historyPatterns.some((p) => p.test(section.line))) {
        // Strip HTML tags to get plain text
        const text = section.text
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        if (text.length > 50) return text
      }
    }

    return null
  } catch {
    return null
  }
}

// --- Haversine distance ---

export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// --- Resume capability ---

export interface WikiEnrichment {
  wikiTitle: string
  wikidataId?: string
  resolvedVia: 'url' | 'pleiades' | 'name-search' | 'wikidata-search'
  confidence: number
  extract: string
  romanEraExtract: string
  thumbnail?: { url: string; width: number; height: number }
  wikipediaUrl: string
  wikidataUrl?: string
  fetchedAt: string

  /** 0.0–1.0 score of how Roman-era relevant the extract is */
  romanRelevance?: number
  /** If set, this article is likely wrong (disambiguation, modern namesake, etc.) */
  wrongArticle?: string
}

export type WikiLookup = Record<string, WikiEnrichment>

export async function loadExistingOutput(path: string): Promise<WikiLookup> {
  try {
    const raw = await readFile(path, 'utf-8')
    return JSON.parse(raw) as WikiLookup
  } catch {
    return {}
  }
}

export function buildEnrichment(
  summary: WikiSummary,
  resolvedVia: WikiEnrichment['resolvedVia'],
  confidence: number,
  wikidataId?: string,
  expectedType?: 'battle' | 'amphitheater' | 'settlement' | 'building',
): WikiEnrichment {
  const extract = summary.extract || ''
  const relevance = scoreRomanRelevance(extract, summary.description)
  const wrong = detectWrongArticle(extract, expectedType)

  return {
    wikiTitle: summary.title,
    wikidataId,
    resolvedVia,
    confidence,
    extract,
    romanEraExtract: extractRomanContent(extract),
    thumbnail: summary.thumbnail
      ? {
          url: summary.thumbnail.source,
          width: summary.thumbnail.width,
          height: summary.thumbnail.height,
        }
      : undefined,
    wikipediaUrl:
      summary.content_urls?.desktop?.page ??
      `https://en.wikipedia.org/wiki/${encodeURIComponent(summary.title.replace(/ /g, '_'))}`,
    wikidataUrl: wikidataId ? `https://www.wikidata.org/wiki/${wikidataId}` : undefined,
    fetchedAt: new Date().toISOString(),
    romanRelevance: relevance,
    wrongArticle: wrong ?? undefined,
  }
}

// --- Wikimedia Commons image metadata ---

export interface CommonsImageInfo {
  url: string
  descriptionUrl: string
  title: string
  license: string
  width: number
  height: number
}

/**
 * Fetch image metadata from Wikimedia Commons for a given filename.
 * The filename comes from Wikidata P18 (e.g. "Colosseo 2020.jpg").
 */
export async function fetchCommonsImageInfo(filename: string): Promise<CommonsImageInfo | null> {
  const title = `File:${filename.replace(/ /g, '_')}`
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}` +
    `&prop=imageinfo&iiprop=url|extmetadata|size&format=json`

  try {
    const res = await rateLimitedFetch(url, 100)
    if (!res.ok) return null
    const data = (await res.json()) as {
      query: {
        pages: Record<
          string,
          {
            imageinfo?: Array<{
              url: string
              descriptionurl: string
              width: number
              height: number
              extmetadata?: {
                LicenseShortName?: { value: string }
              }
            }>
          }
        >
      }
    }
    const pages = Object.values(data.query.pages)
    const info = pages[0]?.imageinfo?.[0]
    if (!info) return null

    return {
      url: info.url,
      descriptionUrl: info.descriptionurl,
      title: filename,
      license: info.extmetadata?.LicenseShortName?.value ?? 'Unknown',
      width: info.width,
      height: info.height,
    }
  } catch {
    return null
  }
}

// --- Wikidata structured claim extraction ---

export interface WikidataClaim {
  property: string
  propertyLabel: string
  value: string
  valueLabel?: string
  sourceRef?: string
  sourced: boolean
  qualifiers?: Record<string, string>
}

export interface DescribedInSource {
  title: string
  author?: string
  wikidataId: string
  passage?: string
}

/**
 * Query Wikidata for structured claims about an entity.
 * Uses two separate queries: one for values+labels, one for reference checks.
 * This avoids Cartesian products from OPTIONAL reference joins.
 */
export async function fetchStructuredClaims(
  wikidataId: string,
  propertyIds: string[],
): Promise<WikidataClaim[]> {
  if (propertyIds.length === 0) return []

  const propValues = propertyIds.map((p) => `wdt:${p}`).join(' ')

  // Query 1: Get distinct property-value pairs with labels
  const valuesQuery = `
    SELECT DISTINCT ?propId ?propLabel ?value ?valueLabel WHERE {
      VALUES ?propDirect { ${propValues} }
      wd:${wikidataId} ?propDirect ?value .
      ?property wikibase:directClaim ?propDirect .
      BIND(STRAFTER(STR(?property), "http://www.wikidata.org/entity/") AS ?propId)
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
    }
    LIMIT 200
  `

  // Query 2: Check which properties have at least one P248 reference
  const refsQuery = `
    SELECT DISTINCT ?propId ?refSourceLabel WHERE {
      VALUES ?propDirect { ${propValues} }
      wd:${wikidataId} ?propDirect ?val .
      ?property wikibase:directClaim ?propDirect ;
               wikibase:claim ?stProp ;
               wikibase:statementProperty ?ps .
      wd:${wikidataId} ?stProp ?statement .
      ?statement ?ps ?val .
      ?statement prov:wasDerivedFrom/pr:P248 ?refSource .
      BIND(STRAFTER(STR(?property), "http://www.wikidata.org/entity/") AS ?propId)
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
    }
    LIMIT 200
  `

  try {
    const [valResults, refResults] = await Promise.all([
      sparqlQuery(valuesQuery),
      sparqlQuery(refsQuery).catch(() => [] as Record<string, unknown>[]),
    ])

    // Build a set of properties that have at least one reference
    const sourcedProps = new Map<string, string>() // propId -> first refSourceLabel
    for (const r of refResults) {
      const pid = r.propId as string
      if (!sourcedProps.has(pid)) {
        sourcedProps.set(pid, r.refSourceLabel as string)
      }
    }

    // Deduplicate: track seen property+value combos
    const seen = new Set<string>()
    const claims: WikidataClaim[] = []

    for (const r of valResults) {
      const propId = r.propId as string
      const value = r.value as string
      const dedupeKey = `${propId}|${value}`
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)

      claims.push({
        property: propId,
        propertyLabel: r.propLabel as string,
        value,
        valueLabel: r.valueLabel as string | undefined,
        sourceRef: sourcedProps.get(propId),
        sourced: sourcedProps.has(propId),
      })
    }

    return claims
  } catch (err) {
    console.warn(`  SPARQL error for ${wikidataId}: ${(err as Error).message}`)
    return []
  }
}

/**
 * Query Wikidata P1343 ("described by source") for ancient text citations.
 */
export async function fetchDescribedInSources(wikidataId: string): Promise<DescribedInSource[]> {
  const query = `
    SELECT ?source ?sourceLabel ?authorLabel WHERE {
      wd:${wikidataId} wdt:P1343 ?source .
      OPTIONAL { ?source wdt:P50 ?author . }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
    }
    LIMIT 50
  `

  try {
    const results = await sparqlQuery(query)
    return results.map((r) => ({
      title: r.sourceLabel as string,
      author: r.authorLabel as string | undefined,
      wikidataId: extractQId(r.source as string),
    }))
  } catch {
    return []
  }
}

/** Extract Q-id from a Wikidata entity URL */
function extractQId(url: string): string {
  const match = url.match(/Q\d+$/)
  return match ? match[0] : url
}

/**
 * Parse a Wikidata time value into a year number.
 * Handles multiple formats:
 * - SPARQL xsd:dateTime: "0072-01-01T00:00:00Z" or "-0509-01-01T00:00:00Z"
 * - Wikidata internal: "+0072-01-01T00:00:00Z"
 * - Label service output: "72" or "509 BC" or "1st century"
 * Returns null if parsing fails.
 */
export function parseWikidataYear(value: string): number | null {
  if (!value) return null

  // Try standard Wikidata time format: +YYYY-MM-DD or -YYYY-MM-DD
  const isoMatch = value.match(/^([+-]?)0*(\d+)-\d{2}-\d{2}/)
  if (isoMatch) {
    const year = parseInt(isoMatch[2], 10)
    if (year === 0) return null
    return isoMatch[1] === '-' ? -year : year
  }

  // Try "NNN BC/AD" label format
  const labelMatch = value.match(/^(\d+)\s*(BC|BCE|AD|CE)?$/i)
  if (labelMatch) {
    const year = parseInt(labelMatch[1], 10)
    if (year === 0) return null
    const era = (labelMatch[2] ?? '').toUpperCase()
    return era === 'BC' || era === 'BCE' ? -year : year
  }

  return null
}

/**
 * Clean a Wikidata value for display.
 * - Strips Wikidata entity URIs, keeping only the label
 * - Decodes URL-encoded filenames
 * - Strips xsd:dateTime suffixes
 */
export function cleanWikidataValue(value: string, valueLabel?: string): string {
  // If label service resolved it to a human-readable name, prefer that
  if (valueLabel && valueLabel !== value && !valueLabel.startsWith('http')) {
    return valueLabel
  }
  // Strip entity URIs
  if (value.startsWith('http://www.wikidata.org/entity/')) {
    return value.replace('http://www.wikidata.org/entity/', '')
  }
  // Strip commons file paths
  if (value.includes('Special:FilePath/')) {
    return decodeURIComponent(value.replace(/^.*Special:FilePath\//, '').replace(/_/g, ' '))
  }
  return value
}
