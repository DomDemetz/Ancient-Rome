/**
 * Re-score existing wiki enrichment data for Roman-era relevance.
 *
 * For each entry:
 * 1. Compute romanRelevance score (0.0–1.0)
 * 2. Detect wrong articles (disambiguation, modern namesakes)
 * 3. For low-relevance settlements, attempt to fetch the Wikipedia "History" section
 *    to extract better Roman-era content
 *
 * Usage: npx tsx scripts/rescore-roman-relevance.ts
 */

import { readFile, writeFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'
import {
  scoreRomanRelevance,
  detectWrongArticle,
  extractRomanContent,
  fetchWikiHistorySection,
  type WikiLookup,
} from './lib/wiki-api.js'

interface FileConfig {
  file: string
  expectedType: 'battle' | 'amphitheater' | 'settlement' | 'building'
  /** Whether to attempt fetching History sections for low-relevance entries */
  fetchHistory: boolean
}

const FILES: FileConfig[] = [
  { file: 'settlements-wiki.json', expectedType: 'settlement', fetchHistory: true },
  { file: 'amphitheaters-wiki.json', expectedType: 'amphitheater', fetchHistory: false },
  { file: 'battles-wiki.json', expectedType: 'battle', fetchHistory: false },
  { file: 'buildings-wiki.json', expectedType: 'building', fetchHistory: false },
  { file: 'entities-wiki.json', expectedType: 'settlement', fetchHistory: true },
]

async function processFile(config: FileConfig): Promise<{
  total: number
  wrongArticle: number
  lowRelevance: number
  historyFetched: number
  historyImproved: number
}> {
  const path = fileURLToPath(new URL(`../src/data/wiki/${config.file}`, import.meta.url))
  if (!existsSync(path)) {
    console.log(`  SKIP: ${config.file} not found`)
    return { total: 0, wrongArticle: 0, lowRelevance: 0, historyFetched: 0, historyImproved: 0 }
  }

  const raw = await readFile(path, 'utf-8')
  const data = JSON.parse(raw) as WikiLookup
  const entries = Object.entries(data)

  let wrongArticle = 0
  let lowRelevance = 0
  let historyFetched = 0
  let historyImproved = 0

  for (let i = 0; i < entries.length; i++) {
    const [, entry] = entries[i]

    // Score relevance
    const relevance = scoreRomanRelevance(entry.extract)
    entry.romanRelevance = relevance

    // Detect wrong articles
    const wrong = detectWrongArticle(entry.extract, config.expectedType)
    if (wrong) {
      entry.wrongArticle = wrong
      wrongArticle++
    } else {
      delete entry.wrongArticle
    }

    // For low-relevance entries, try fetching the History section
    if (config.fetchHistory && relevance < 0.3 && !wrong) {
      try {
        const historyText = await fetchWikiHistorySection(entry.wikiTitle)
        historyFetched++

        if (historyText) {
          const historyRelevance = scoreRomanRelevance(historyText)
          if (historyRelevance > relevance) {
            // Found better Roman content in the History section
            const romanContent = extractRomanContent(historyText)
            if (romanContent && romanContent.length > 50) {
              entry.romanEraExtract = romanContent
              entry.romanRelevance = historyRelevance
              historyImproved++
            }
          }
        }
      } catch {
        // Non-critical — skip
      }

      // Progress for slow History section fetches
      if (historyFetched % 50 === 0) {
        console.log(
          `    ${historyFetched} history sections checked, ${historyImproved} improved...`,
        )
      }
    }
  }

  lowRelevance = entries.filter(([, e]) => (e.romanRelevance ?? 0) < 0.3 && !e.wrongArticle).length

  // Write back
  await writeFile(path, JSON.stringify(data, null, 2))

  return { total: entries.length, wrongArticle, lowRelevance, historyFetched, historyImproved }
}

async function main() {
  console.log('Re-scoring Roman-era relevance...\n')

  for (const config of FILES) {
    console.log(`Processing ${config.file}...`)
    const result = await processFile(config)
    console.log(`  ${result.total} entries`)
    console.log(`  Wrong articles flagged: ${result.wrongArticle}`)
    console.log(`  Low relevance (<0.3): ${result.lowRelevance}`)
    if (config.fetchHistory) {
      console.log(`  History sections checked: ${result.historyFetched}`)
      console.log(`  Improved from history: ${result.historyImproved}`)
    }
    console.log()
  }

  console.log('Done. Re-run validate:wiki to check results.')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
