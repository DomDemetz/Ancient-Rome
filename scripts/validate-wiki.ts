/**
 * Validates wiki enrichment JSON files, including structured Wikidata data.
 *
 * Usage: npx tsx scripts/validate-wiki.ts
 */

import { readFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

interface WikiEnrichment {
  wikiTitle: string
  wikidataId?: string
  resolvedVia: string
  confidence: number
  extract: string
  romanEraExtract: string
  thumbnail?: { url: string; width: number; height: number }
  wikipediaUrl: string
  wikidataUrl?: string
  fetchedAt: string
  romanRelevance?: number
  wrongArticle?: string
}

type WikiLookup = Record<string, WikiEnrichment>

interface WikidataStructuredEntry {
  wikidataId: string
  structured: {
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
    describedIn?: Array<{ title: string; author?: string }>
  }
  images: Array<{ url: string; caption: string; license: string }>
  describedInSources: Array<{ title: string; wikidataId: string }>
  sourceQuality: 'academic' | 'sourced' | 'unsourced'
  claims: Array<{ property: string; label: string; value: string; sourced: boolean }>
  fetchedAt: string
}

type WikidataStructuredLookup = Record<string, WikidataStructuredEntry>

const FILES = [
  'entities-wiki.json',
  'amphitheaters-wiki.json',
  'buildings-wiki.json',
  'battles-wiki.json',
  'settlements-wiki.json',
]

const STRUCTURED_FILE = 'wikidata-structured.json'

let totalErrors = 0
let totalWarnings = 0
let totalEntries = 0

async function validateFile(filename: string): Promise<void> {
  const path = fileURLToPath(new URL(`../src/data/wiki/${filename}`, import.meta.url))

  if (!existsSync(path)) {
    console.log(`  SKIP: ${filename} (not found)`)
    return
  }

  const raw = await readFile(path, 'utf-8')
  let data: WikiLookup
  try {
    data = JSON.parse(raw)
  } catch {
    console.error(`  ERROR: ${filename} is not valid JSON`)
    totalErrors++
    return
  }

  const entries = Object.entries(data)
  console.log(`  ${filename}: ${entries.length} entries`)
  totalEntries += entries.length

  const seenTitles = new Map<string, string>()
  let errors = 0
  let warnings = 0

  for (const [id, entry] of entries) {
    // Required fields
    if (!entry.extract) {
      console.error(`    ERROR: ${id} has empty extract`)
      errors++
    }
    if (!entry.romanEraExtract) {
      console.error(`    ERROR: ${id} has empty romanEraExtract`)
      errors++
    }
    if (!entry.wikipediaUrl) {
      console.error(`    ERROR: ${id} has empty wikipediaUrl`)
      errors++
    }

    // Valid URL
    if (entry.wikipediaUrl && !entry.wikipediaUrl.startsWith('https://')) {
      console.error(`    ERROR: ${id} has invalid URL: ${entry.wikipediaUrl}`)
      errors++
    }

    // Confidence range
    if (entry.confidence < 0 || entry.confidence > 1) {
      console.error(`    ERROR: ${id} has confidence out of range: ${entry.confidence}`)
      errors++
    }

    // Duplicate titles
    if (seenTitles.has(entry.wikiTitle) && seenTitles.get(entry.wikiTitle) !== id) {
      console.warn(
        `    WARN: duplicate wikiTitle "${entry.wikiTitle}" (${id} and ${seenTitles.get(entry.wikiTitle)})`,
      )
      warnings++
    }
    seenTitles.set(entry.wikiTitle, id)
  }

  // Sample thumbnail accessibility check (10%)
  const thumbEntries = entries.filter(([, e]) => e.thumbnail?.url)
  const sampleSize = Math.max(1, Math.ceil(thumbEntries.length * 0.1))
  const sample = thumbEntries.sort(() => Math.random() - 0.5).slice(0, sampleSize)

  let thumbOk = 0
  for (const [id, entry] of sample) {
    try {
      const res = await fetch(entry.thumbnail!.url, { method: 'HEAD' })
      if (res.ok) thumbOk++
      else {
        console.warn(`    WARN: thumbnail 404 for ${id}: ${entry.thumbnail!.url}`)
      }
    } catch {
      // Network error — non-critical
    }
  }

  if (sample.length > 0) {
    console.log(`    Thumbnails sampled: ${thumbOk}/${sample.length} accessible`)
  }

  // Roman relevance stats (if scored)
  const scoredEntries = entries.filter(([, e]) => e.romanRelevance != null)
  if (scoredEntries.length > 0) {
    const wrongCount = entries.filter(([, e]) => e.wrongArticle).length
    const lowCount = scoredEntries.filter(
      ([, e]) => (e.romanRelevance ?? 0) < 0.3 && !e.wrongArticle,
    ).length
    const medCount = scoredEntries.filter(
      ([, e]) => (e.romanRelevance ?? 0) >= 0.3 && (e.romanRelevance ?? 0) < 0.6,
    ).length
    const highCount = scoredEntries.filter(([, e]) => (e.romanRelevance ?? 0) >= 0.6).length
    console.log(
      `    Roman relevance: ${highCount} high, ${medCount} medium, ${lowCount} low, ${wrongCount} wrong-article`,
    )
    if (wrongCount > 0) {
      console.warn(`    WARN: ${wrongCount} entries flagged as wrong articles`)
      warnings += wrongCount
    }
  }

  totalErrors += errors
  totalWarnings += warnings
}

async function validateStructured(wikiFiles: Map<string, WikiLookup>): Promise<void> {
  const path = fileURLToPath(new URL(`../src/data/wiki/${STRUCTURED_FILE}`, import.meta.url))

  if (!existsSync(path)) {
    console.log(`\n  SKIP: ${STRUCTURED_FILE} (not found — run enrich:wikidata first)`)
    return
  }

  const raw = await readFile(path, 'utf-8')
  let data: WikidataStructuredLookup
  try {
    data = JSON.parse(raw)
  } catch {
    console.error(`  ERROR: ${STRUCTURED_FILE} is not valid JSON`)
    totalErrors++
    return
  }

  const entries = Object.entries(data)
  console.log(`\n  ${STRUCTURED_FILE}: ${entries.length} entries`)

  let errors = 0
  let warnings = 0
  let dateConflicts = 0
  const qualityCounts = { academic: 0, sourced: 0, unsourced: 0 }

  for (const [id, entry] of entries) {
    // Required fields
    if (!entry.wikidataId) {
      console.error(`    ERROR: ${id} has no wikidataId`)
      errors++
    }
    if (!entry.sourceQuality) {
      console.error(`    ERROR: ${id} has no sourceQuality`)
      errors++
    }

    // Valid sourceQuality
    if (
      entry.sourceQuality &&
      !['academic', 'sourced', 'unsourced'].includes(entry.sourceQuality)
    ) {
      console.error(`    ERROR: ${id} has invalid sourceQuality: ${entry.sourceQuality}`)
      errors++
    }

    // Count quality
    if (entry.sourceQuality) qualityCounts[entry.sourceQuality]++

    // Cross-check dates against wiki data
    if (entry.structured?.inceptionYear) {
      for (const [, wikiLookup] of wikiFiles) {
        const wikiEntry = wikiLookup[id]
        if (!wikiEntry) continue
        // Check if Wikipedia extract mentions a different date
        const extractYear = extractYearFromText(wikiEntry.extract)
        if (extractYear && Math.abs(extractYear - entry.structured.inceptionYear) > 20) {
          console.warn(
            `    WARN: date conflict for ${id}: Wikidata says ${entry.structured.inceptionYear}, extract suggests ${extractYear}`,
          )
          dateConflicts++
          warnings++
        }
      }
    }

    // Validate images have URLs
    if (entry.images) {
      for (const img of entry.images) {
        if (!img.url || !img.url.startsWith('https://')) {
          console.error(`    ERROR: ${id} has invalid image URL: ${img.url}`)
          errors++
        }
      }
    }

    // Validate claims have property IDs
    if (entry.claims) {
      for (const claim of entry.claims) {
        if (!claim.property || !claim.property.startsWith('P')) {
          console.error(`    ERROR: ${id} has invalid claim property: ${claim.property}`)
          errors++
        }
      }
    }
  }

  console.log(
    `    Source quality: ${qualityCounts.academic} academic, ${qualityCounts.sourced} sourced, ${qualityCounts.unsourced} unsourced`,
  )
  if (dateConflicts > 0) {
    console.log(`    Date conflicts: ${dateConflicts} (Wikidata vs. Wikipedia text)`)
  }

  // Sourced claim ratio
  let totalClaims = 0
  let sourcedClaims = 0
  for (const entry of Object.values(data)) {
    for (const claim of entry.claims ?? []) {
      totalClaims++
      if (claim.sourced) sourcedClaims++
    }
  }
  if (totalClaims > 0) {
    const pct = ((sourcedClaims / totalClaims) * 100).toFixed(1)
    console.log(`    Sourced claims: ${sourcedClaims}/${totalClaims} (${pct}%)`)
  }

  totalErrors += errors
  totalWarnings += warnings
}

/** Try to extract a prominent year from text (simple heuristic) */
function extractYearFromText(text: string): number | null {
  // Look for "in NNN AD/BC" or "NNN BC/AD" patterns
  const match = text.match(/\b(\d{1,4})\s*(AD|BC|BCE|CE)\b/i)
  if (!match) return null
  const year = parseInt(match[1], 10)
  const era = match[2].toUpperCase()
  if (era === 'BC' || era === 'BCE') return -year
  return year
}

async function main() {
  console.log('Validating Wikipedia enrichment data...\n')

  // Load wiki files for cross-checking
  const wikiFiles = new Map<string, WikiLookup>()

  for (const file of FILES) {
    await validateFile(file)

    // Also load for cross-checking with structured data
    const path = fileURLToPath(new URL(`../src/data/wiki/${file}`, import.meta.url))
    if (existsSync(path)) {
      try {
        const raw = await readFile(path, 'utf-8')
        wikiFiles.set(file, JSON.parse(raw) as WikiLookup)
      } catch {
        /* skip */
      }
    }
  }

  // Validate structured data
  await validateStructured(wikiFiles)

  console.log(`\nSummary:`)
  console.log(`  Total wiki entries: ${totalEntries}`)
  console.log(`  Errors: ${totalErrors}`)
  console.log(`  Warnings: ${totalWarnings}`)

  if (totalErrors > 0) {
    console.error('\nValidation FAILED')
    process.exit(1)
  }

  console.log('\nValidation passed.')
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
