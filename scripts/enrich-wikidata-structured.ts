/**
 * Wikidata Structured Enrichment Script
 *
 * Queries Wikidata SPARQL for structured properties per feature,
 * only accepting claims with references (P248 "stated in") as "sourced".
 *
 * Usage: npx tsx scripts/enrich-wikidata-structured.ts
 */

import { readFile, writeFile, mkdir } from 'fs/promises'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'
import {
  fetchStructuredClaims,
  fetchDescribedInSources,
  fetchCommonsImageInfo,
  parseWikidataYear,
  cleanWikidataValue,
  haversineDistance,
  type WikidataClaim,
  type DescribedInSource,
} from './lib/wiki-api.js'
import { getPropertiesForType, type FeatureType } from './lib/wikidata-properties.js'

// --- Output types ---

interface StructuredData {
  inceptionYear?: number
  destructionYear?: number
  materials?: string[]
  dimensions?: { height?: string; area?: string; capacity?: number }
  architect?: string
  commissionedBy?: string
  heritageStatus?: string
  administrativeType?: string
  participants?: string[]
  casualties?: number
  winner?: string
  architecturalStyle?: string
  describedIn?: Array<{ title: string; author?: string; passage?: string }>
}

interface WikidataImage {
  url: string
  caption: string
  license: string
  width: number
  height: number
}

interface WikidataEnrichment {
  wikidataId: string
  structured: StructuredData
  images: WikidataImage[]
  describedInSources: DescribedInSource[]
  sourceQuality: 'academic' | 'sourced' | 'unsourced'
  claims: Array<{
    property: string
    label: string
    value: string
    sourced: boolean
    sourceRef?: string
  }>
  fetchedAt: string
}

type WikidataStructuredLookup = Record<string, WikidataEnrichment>

// --- Wiki data loading ---

interface WikiEntry {
  wikiTitle: string
  wikidataId?: string
  confidence: number
}

interface SourceFeature {
  id: string
  lat?: number
  lng?: number
  constructionYear?: number
  year?: number
}

const SOURCE_DATA_FILES: Partial<Record<FeatureType, string>> = {
  amphitheaters: '../src/data/amphitheaters/amphitheaters.json',
  battles: '../src/data/battles/battles.json',
  settlements: '../src/data/dare/settlements.json',
  buildings: '../src/data/buildings/buildings.json',
}

/** Load source data for coordinate/date cross-validation */
async function loadSourceData(featureType: FeatureType): Promise<Map<string, SourceFeature>> {
  const relPath = SOURCE_DATA_FILES[featureType]
  if (!relPath) return new Map()
  const path = fileURLToPath(new URL(relPath, import.meta.url))
  if (!existsSync(path)) return new Map()
  try {
    const raw = await readFile(path, 'utf-8')
    const arr = JSON.parse(raw) as SourceFeature[]
    return new Map(arr.map((f) => [f.id, f]))
  } catch {
    return new Map()
  }
}

const WIKI_FILES: Record<FeatureType, string> = {
  amphitheaters: 'amphitheaters-wiki.json',
  battles: 'battles-wiki.json',
  settlements: 'settlements-wiki.json',
  buildings: 'buildings-wiki.json',
  entities: 'entities-wiki.json',
}

const OUTPUT_PATH = fileURLToPath(
  new URL('../src/data/wiki/wikidata-structured.json', import.meta.url),
)
const CHECKPOINT_INTERVAL = 25

// --- Main logic ---

/**
 * Build structured data from claims.
 *
 * ACCURACY POLICY:
 * - Only sourced claims (with P248 references) are used for structured facts.
 * - Unsourced claims are stored separately in the raw claims array for transparency,
 *   but never surface as "facts" in the UI.
 * - The only exception: P31 (instance of) and P710 (participants) are allowed unsourced
 *   because they are classificatory, not factual assertions.
 */
function buildStructuredData(
  claims: WikidataClaim[],
  sources: DescribedInSource[],
  featureType: FeatureType,
): StructuredData {
  const data: StructuredData = {}

  // Group claims by property, separating sourced from unsourced
  const byProp = new Map<string, WikidataClaim[]>()
  for (const c of claims) {
    const existing = byProp.get(c.property) ?? []
    existing.push(c)
    byProp.set(c.property, existing)
  }

  /** Get the first sourced claim for a property, or null */
  function getSourced(propId: string): WikidataClaim | null {
    const arr = byProp.get(propId)
    if (!arr) return null
    return arr.find((c) => c.sourced) ?? null
  }

  /** Get all sourced claims for a property */
  function getAllSourced(propId: string): WikidataClaim[] {
    return (byProp.get(propId) ?? []).filter((c) => c.sourced)
  }

  /** Get all claims (sourced or not) — only for classificatory properties */
  function getAll(propId: string): WikidataClaim[] {
    return byProp.get(propId) ?? []
  }

  function label(c: WikidataClaim): string {
    return cleanWikidataValue(c.value, c.valueLabel)
  }

  // --- Temporal (sourced only) ---

  const inception = getSourced('P571')
  if (inception) {
    const year = parseWikidataYear(inception.value)
    if (year !== null) data.inceptionYear = year
  }

  const destruction = getSourced('P576')
  if (destruction) {
    const year = parseWikidataYear(destruction.value)
    if (year !== null) data.destructionYear = year
  }

  // --- Physical (sourced only) ---

  const materials = getAllSourced('P186')
  if (materials.length) {
    data.materials = [...new Set(materials.map(label))].filter(Boolean)
  }

  const height = getSourced('P2048')
  if (height) data.dimensions = { ...data.dimensions, height: label(height) }

  const area = getSourced('P2046')
  if (area) data.dimensions = { ...data.dimensions, area: label(area) }

  const capacity = getSourced('P1083')
  if (capacity) {
    const num = parseInt(capacity.value, 10)
    if (!isNaN(num) && num > 0) data.dimensions = { ...data.dimensions, capacity: num }
  }

  // --- Attribution (sourced only) ---

  const architect = getSourced('P84')
  if (architect) data.architect = label(architect)

  const commissioned = getSourced('P88')
  if (commissioned) data.commissionedBy = label(commissioned)

  const style = getSourced('P149')
  if (style) data.architecturalStyle = label(style)

  const heritage = getSourced('P1435')
  if (heritage) data.heritageStatus = label(heritage)

  // --- Classificatory (allowed unsourced — these are structural, not factual) ---

  if (featureType === 'settlements') {
    const instanceOf = getAll('P31')
    if (instanceOf.length) {
      const romanTypes = instanceOf
        .map(label)
        .filter((l) => /colonia|municipium|civitas|oppidum|castrum|castra/i.test(l))
      if (romanTypes.length) data.administrativeType = romanTypes[0]
    }
  }

  if (featureType === 'battles') {
    // Participants are classificatory
    const participants = getAll('P710')
    if (participants.length) {
      data.participants = [...new Set(participants.map(label))].filter(Boolean)
    }
    // Casualties and winner are factual — sourced only
    const deaths = getSourced('P1120')
    if (deaths) {
      const num = parseInt(deaths.value, 10)
      if (!isNaN(num) && num > 0) data.casualties = num
    }
    const winner = getSourced('P1346')
    if (winner) data.winner = label(winner)
  }

  // --- Ancient sources from P1343 ---
  if (sources.length) {
    // Filter to likely ancient/academic sources — exclude modern encyclopedias
    const ancientSources = sources.filter((s) => !isModernEncyclopedia(s.title))
    if (ancientSources.length) {
      data.describedIn = ancientSources.map((s) => ({
        title: s.title,
        author: s.author,
      }))
    }
  }

  return data
}

/** Known modern encyclopedias that should NOT be treated as ancient sources */
const MODERN_ENCYCLOPEDIA_PATTERNS = [
  /encyclop[aæ]edia\s+britannica/i,
  /brockhaus/i,
  /gran\s+enciclopedia/i,
  /grande\s+dizionario/i,
  /encyclop[aæ]die\s+larousse/i,
  /wikipedia/i,
  /encyclopedia\s+americana/i,
  /neue\s+deutsche\s+biographie/i,
  /dictionary\s+of\s+national\s+biography/i,
  /allgemeine\s+deutsche\s+biographie/i,
]

function isModernEncyclopedia(title: string): boolean {
  return MODERN_ENCYCLOPEDIA_PATTERNS.some((p) => p.test(title))
}

/**
 * Assess source quality with stricter criteria:
 * - "academic": has ancient/scholarly text citations (P1343, excluding modern encyclopedias)
 * - "sourced": has at least one claim backed by a P248 reference
 * - "unsourced": all claims lack references
 */
function assessSourceQuality(
  claims: WikidataClaim[],
  sources: DescribedInSource[],
): 'academic' | 'sourced' | 'unsourced' {
  const ancientSources = sources.filter((s) => !isModernEncyclopedia(s.title))
  if (ancientSources.length > 0) return 'academic'
  const sourcedCount = claims.filter((c) => c.sourced).length
  if (sourcedCount > 0) return 'sourced'
  return 'unsourced'
}

async function processFeatureType(
  featureType: FeatureType,
  existing: WikidataStructuredLookup,
): Promise<{ enriched: number; skipped: number; failed: number; rejected: number }> {
  const wikiPath = fileURLToPath(
    new URL(`../src/data/wiki/${WIKI_FILES[featureType]}`, import.meta.url),
  )

  if (!existsSync(wikiPath)) {
    console.log(`  SKIP: ${WIKI_FILES[featureType]} not found`)
    return { enriched: 0, skipped: 0, failed: 0, rejected: 0 }
  }

  const raw = await readFile(wikiPath, 'utf-8')
  const wikiData = JSON.parse(raw) as Record<string, WikiEntry>
  const entries = Object.entries(wikiData).filter(([, entry]) => entry.wikidataId)

  // Load source data for cross-validation
  const sourceData = await loadSourceData(featureType)

  console.log(
    `  ${featureType}: ${entries.length} entries with wikidataId (${sourceData.size} source features for validation)`,
  )

  const props = getPropertiesForType(featureType)
  const propIds = props.map((p) => p.id)

  let enriched = 0
  let skipped = 0
  let failed = 0
  let rejected = 0

  for (let i = 0; i < entries.length; i++) {
    const [id, entry] = entries[i]
    const wdId = entry.wikidataId!

    // Skip if already enriched
    if (existing[id]) {
      skipped++
      continue
    }

    try {
      // Fetch structured claims
      const claims = await fetchStructuredClaims(wdId, propIds)

      // Fetch "described by source" (P1343) separately for richer data
      const sources = await fetchDescribedInSources(wdId)

      // --- Coordinate cross-validation ---
      const sourceFeature = sourceData.get(id)
      if (sourceFeature?.lat != null && sourceFeature?.lng != null) {
        const coordClaim = claims.find((c) => c.property === 'P625')
        if (coordClaim) {
          const coordMatch = coordClaim.value.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/)
          if (coordMatch) {
            const wdLng = parseFloat(coordMatch[1])
            const wdLat = parseFloat(coordMatch[2])
            const dist = haversineDistance(sourceFeature.lat, sourceFeature.lng, wdLat, wdLng)
            if (dist > 50) {
              console.warn(
                `    REJECT: ${id} — Wikidata coords ${dist.toFixed(0)}km from source (>${'50km threshold'})`,
              )
              rejected++
              continue
            }
          }
        }
      }

      // --- Extract images from P18 claims ---
      const imageClaims = claims.filter((c) => c.property === 'P18')
      const images: WikidataImage[] = []

      for (const ic of imageClaims.slice(0, 3)) {
        // P18 value is a commons URL like: http://commons.wikimedia.org/wiki/Special:FilePath/Name.jpg
        let filename = ''
        if (ic.value.includes('Special:FilePath/')) {
          filename = decodeURIComponent(ic.value.replace(/^.*Special:FilePath\//, '')).replace(
            /_/g,
            ' ',
          )
        } else if (ic.valueLabel && !ic.valueLabel.startsWith('http')) {
          filename = ic.valueLabel
        }
        if (filename) {
          const info = await fetchCommonsImageInfo(filename)
          if (info) {
            images.push({
              url: info.url,
              caption: info.title,
              license: info.license,
              width: info.width,
              height: info.height,
            })
          }
        }
      }

      // Build structured data (excluding P18/P625 from structured — they're handled separately)
      const structuralClaims = claims.filter((c) => c.property !== 'P18' && c.property !== 'P625')
      const structured = buildStructuredData(structuralClaims, sources, featureType)

      // --- Date cross-validation warning ---
      if (structured.inceptionYear && sourceFeature) {
        const sourceYear = sourceFeature.constructionYear ?? sourceFeature.year
        if (sourceYear && Math.abs(sourceYear - structured.inceptionYear) > 50) {
          console.warn(
            `    WARN: ${id} — date mismatch: Wikidata inception=${structured.inceptionYear}, source=${sourceYear} (diff >${50})`,
          )
          // Don't reject, but log the conflict. The sourced Wikidata value is kept.
        }
      }

      const enrichment: WikidataEnrichment = {
        wikidataId: wdId,
        structured,
        images,
        describedInSources: sources.filter((s) => !isModernEncyclopedia(s.title)),
        sourceQuality: assessSourceQuality(structuralClaims, sources),
        claims: structuralClaims.map((c) => ({
          property: c.property,
          label: c.propertyLabel,
          value: cleanWikidataValue(c.value, c.valueLabel),
          sourced: c.sourced,
          sourceRef: c.sourceRef,
        })),
        fetchedAt: new Date().toISOString(),
      }

      existing[id] = enrichment
      enriched++

      if (enriched % 10 === 0) {
        const q = enrichment.sourceQuality
        process.stdout.write(`    ${enriched}/${entries.length - skipped} (${q})\n`)
      }
    } catch (err) {
      console.warn(`    FAIL: ${id} (${wdId}): ${(err as Error).message}`)
      failed++
    }

    // Checkpoint
    if ((enriched + failed) % CHECKPOINT_INTERVAL === 0 && enriched > 0) {
      await saveOutput(existing)
    }
  }

  return { enriched, skipped, failed, rejected }
}

async function saveOutput(data: WikidataStructuredLookup): Promise<void> {
  const dir = fileURLToPath(new URL('../src/data/wiki', import.meta.url))
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  await writeFile(OUTPUT_PATH, JSON.stringify(data, null, 2))
}

async function main() {
  console.log('Wikidata Structured Enrichment\n')

  // Load existing output for resume capability
  let existing: WikidataStructuredLookup = {}
  if (existsSync(OUTPUT_PATH)) {
    try {
      const raw = await readFile(OUTPUT_PATH, 'utf-8')
      existing = JSON.parse(raw) as WikidataStructuredLookup
      console.log(`Resuming: ${Object.keys(existing).length} entries already enriched\n`)
    } catch {
      console.log('Starting fresh (existing output invalid)\n')
    }
  }

  const featureTypes: FeatureType[] = ['amphitheaters', 'battles', 'settlements', 'buildings']
  const totals = { enriched: 0, skipped: 0, failed: 0, rejected: 0 }

  for (const type of featureTypes) {
    console.log(`\nProcessing ${type}...`)
    const result = await processFeatureType(type, existing)
    totals.enriched += result.enriched
    totals.skipped += result.skipped
    totals.failed += result.failed
    totals.rejected += result.rejected
    console.log(
      `  Done: +${result.enriched} enriched, ${result.skipped} skipped, ${result.failed} failed, ${result.rejected} rejected`,
    )
  }

  await saveOutput(existing)

  console.log(`\nComplete:`)
  console.log(`  Total entries: ${Object.keys(existing).length}`)
  console.log(`  New enrichments: ${totals.enriched}`)
  console.log(`  Skipped (already done): ${totals.skipped}`)
  console.log(`  Failed: ${totals.failed}`)
  console.log(`  Rejected (coordinate drift >50km): ${totals.rejected}`)

  // Source quality summary
  const qualities = Object.values(existing)
  const academic = qualities.filter((e) => e.sourceQuality === 'academic').length
  const sourced = qualities.filter((e) => e.sourceQuality === 'sourced').length
  const unsourced = qualities.filter((e) => e.sourceQuality === 'unsourced').length
  console.log(`\nSource quality: ${academic} academic, ${sourced} sourced, ${unsourced} unsourced`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
