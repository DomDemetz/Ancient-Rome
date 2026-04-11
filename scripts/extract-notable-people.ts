/**
 * Extract notable people from the cross-verified database (Sciences-Po)
 * for the Ancient Rome map layer (753 BC – 476 AD).
 *
 * Source: https://doi.org/10.21410/7E4/RDAG3O
 * License: CC-BY-SA
 *
 * Usage: npx tsx scripts/extract-notable-people.ts
 */

import { createReadStream } from 'fs'
import { writeFile, mkdir } from 'fs/promises'
import { createInterface } from 'readline'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const INPUT = join(__dirname, '..', 'data-sources', 'cross-verified-database.csv')
const OUTPUT_DIR = join(__dirname, '..', 'src', 'data', 'people-layer')
const OUTPUT = join(OUTPUT_DIR, 'notable-people.json')

const MIN_YEAR = -753
const MAX_YEAR = 476

interface NotablePerson {
  id: string
  name: string
  born: number
  died: number | null
  gender: string
  role: string
  domain: string
  citizenship: string
  birthLat: number
  birthLng: number
  deathLat: number | null
  deathLng: number | null
  notability: number
  wikidataId: string
}

function cleanName(raw: string): string {
  // Remove underscores, clean up parenthetical disambiguation
  let name = raw.replace(/_/g, ' ')
  // Remove parenthetical like "(consul 160 BC)" or "(wife of Julian)"
  name = name.replace(/\s*\([^)]*\)\s*/g, '').trim()
  return name
}

function cleanCitizenship(raw: string): string {
  if (!raw) return ''
  return raw
    .replace(/^'|'$/g, '')
    .replace(/_/g, ' ')
    .replace(/Old regimes in \/ of /g, '')
    .trim()
}

function parseFloat_(s: string): number | null {
  if (!s || s === '' || s === 'grA' || s === 'grB') return null
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

function parseInt_(s: string): number | null {
  if (!s || s === '') return null
  const n = parseInt(s, 10)
  return isNaN(n) ? null : n
}

function truncate(n: number, decimals = 4): number {
  const f = Math.pow(10, decimals)
  return Math.round(n * f) / f
}

// Simple CSV parser that handles quoted fields with commas
function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += char
    }
  }
  fields.push(current)
  return fields
}

async function main() {
  console.log('Reading', INPUT)

  const rl = createInterface({
    input: createReadStream(INPUT, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  })

  const people: NotablePerson[] = []
  let lineNum = 0
  let skipped = 0

  for await (const line of rl) {
    lineNum++
    if (lineNum === 1) continue // skip header

    const cols = parseCSVLine(line)
    // Column indices (0-based):
    // 0: wikidata_code, 1: birth, 2: death, 10: gender, 11: level1_main_occ,
    // 12: name, 23: level3_main_occ, 31: sum_visib_ln_5criteria,
    // 35: citizenship_1_b, 43: bplo1, 44: dplo1, 45: bpla1, 46: dpla1

    const birth = parseInt_(cols[1])
    if (birth == null || birth < MIN_YEAR || birth > MAX_YEAR) continue

    const birthLat = parseFloat_(cols[45])
    const birthLng = parseFloat_(cols[43])
    if (birthLat == null || birthLng == null) continue

    // Individually verified wrong birth years in the source data
    const BLOCKLIST = new Set([
      'Q197286', // Zhang Sanfeng — legendary Taoist, 12th-13th century
      'Q3180752', // Ng Mui — legendary Shaolin nun, 17th century
      'Q438379', // Neferneferuaten Tasherit — 18th dynasty Egypt, ~1340 BC
      'Q887355', // En-anna-tum I — Sumerian king, ~2400 BC
      'Q11257156', // Asaki — modern Japanese composer
      'Q3172593', // Jehan Lagadeuc — 15th century Breton lexicographer
      'Q23061186', // Nikolaus von Myra — Saint Nicholas, wrong role
      'Q4498537', // Khnumhotep I — Middle Kingdom Egypt, ~1900 BC
      'Q181408', // Nikoulitzas Delphinas — Byzantine, 11th century
      'Q300767', // Aacheperkareseneb — Middle Kingdom Egypt, ~2000 BC
      'Q19829582', // Ana Carrasco Conde — modern Spanish philosopher
    ])
    if (BLOCKLIST.has(cols[0])) {
      skipped++
      continue
    }

    // Filter obviously bad coordinates (null island)
    if (Math.abs(birthLat) < 0.01 && Math.abs(birthLng) < 0.01) {
      skipped++
      continue
    }

    // --- Data quality filters ---
    // The source database spans 3500 BC–2018 AD. Some modern people have
    // incorrect birth years that fall in our range. We filter them out by:
    // 1. Roles that didn't exist before 500 AD
    // 2. Modern citizenships from countries that didn't exist
    // 3. Suspiciously low notability + no death date (still alive = modern)

    let role = (cols[23] || 'unknown').toLowerCase().replace(/^_/, '')
    // Normalize non-English role labels to English
    const ROLE_NORMALIZE: Record<string, string> = {
      sovrano: 'sovereign',
      sainte: 'saint',
      santo: 'saint',
      santa: 'saint',
      mörda: 'martyr',
      märtyrer: 'martyr',
      martire: 'martyr',
      tochter: 'daughter',
      sohn: 'son',
      mutter: 'mother',
      moglie_di: 'wife',
      chef_de_guerre: 'war chief',
      commandant: 'commander',
      prefetto: 'prefect',
      governatore: 'governor',
      funzionario: 'official',
      diacono: 'deacon',
      igreja: 'priest',
      religioso: 'priest',
      nobile: 'noble',
      reine: 'queen',
      imperador: 'emperor',
      ministro: 'official',
    }
    if (ROLE_NORMALIZE[role]) role = ROLE_NORMALIZE[role]

    const MODERN_ROLES = new Set([
      'journalist',
      'photographer',
      'singer',
      'producer',
      'football',
      'presenter',
      'curator',
      'choreographer',
      'printer',
      'violin',
      'activist',
      'confectioner',
      'draughtswoman',
      'psychiater',
      'radio',
      'seiyū',
      'bassist',
      'ventriloquist',
      'anthropologue',
    ])
    if (MODERN_ROLES.has(role)) {
      skipped++
      continue
    }

    // Countries/entities that didn't exist in our timeframe — these people
    // are modern with wrong birth years in the source data
    const MODERN_COUNTRIES = new Set([
      'US',
      'Canada',
      'Mexico',
      'Venezuela',
      'Argentina',
      'Brazil',
      'Colombia',
      'Chile',
      'Peru',
      'Australia',
      'New Zealand',
      'Congo',
      'Norway',
      'Croatia',
      'Austria',
      'Denmark',
      'Switzerland',
      'Monaco',
      'Nicaragua',
      'Thailand',
      'Russia',
      'Belgium',
    ])
    const citizenship = cleanCitizenship(cols[35])
    if (MODERN_COUNTRIES.has(citizenship)) {
      skipped++
      continue
    }

    const death = parseInt_(cols[2])
    const notability = parseFloat_(cols[31]) ?? 0

    // Birth year 0–4 with no death date = data error (year field defaulted
    // to a small number; these are not people actually born in 1–4 AD)
    if (birth >= 0 && birth <= 4 && death == null) {
      skipped++
      continue
    }

    // Minimum notability threshold — below 15, the data is too noisy
    // (many entries are data errors or extremely obscure non-English entries)
    if (notability < 15) {
      skipped++
      continue
    }

    // Non-English role names indicate poor data quality from non-English
    // Wikipedia editions. At low notability these are unreliable.
    if (notability < 20 && /[àáâãäèéêëìíîïòóôõöùúûü]/.test(role)) {
      skipped++
      continue
    }

    // Suspect modern roles with no death date and low notability
    const SUSPECT_MODERN_ROLES = new Set([
      'actor',
      'painter',
      'artist',
      'writer',
      'dancer',
      'sculptor',
      'engineer',
      'academic',
    ])
    if (SUSPECT_MODERN_ROLES.has(role) && death == null && birth > 0 && notability < 24) {
      skipped++
      continue
    }

    const deathLat = parseFloat_(cols[46])
    const deathLng = parseFloat_(cols[44])

    const name = cleanName(cols[12] || '')
    if (!name) continue

    people.push({
      id: cols[0],
      name,
      born: birth,
      died: death,
      gender: cols[10] || 'Unknown',
      role,
      domain: cols[11] || 'Other',
      citizenship,
      birthLat: truncate(birthLat),
      birthLng: truncate(birthLng),
      deathLat: deathLat != null ? truncate(deathLat) : null,
      deathLng: deathLng != null ? truncate(deathLng) : null,
      notability: truncate(notability, 1),
      wikidataId: cols[0],
    })
  }

  // Sort by notability descending
  people.sort((a, b) => b.notability - a.notability)

  console.log(`Processed ${lineNum - 1} rows`)
  console.log(`Extracted ${people.length} people (skipped ${skipped} bad coordinates)`)
  console.log(`Top 10:`)
  for (const p of people.slice(0, 10)) {
    console.log(`  ${p.name} (${p.born}–${p.died ?? '?'}) — ${p.role}, notability ${p.notability}`)
  }

  // Show domain breakdown
  const domains = new Map<string, number>()
  for (const p of people) {
    domains.set(p.domain, (domains.get(p.domain) ?? 0) + 1)
  }
  console.log(`\nDomain breakdown:`)
  for (const [d, c] of [...domains.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${d}: ${c}`)
  }

  await mkdir(OUTPUT_DIR, { recursive: true })
  await writeFile(OUTPUT, JSON.stringify(people), 'utf-8')

  const sizeKB = Math.round(JSON.stringify(people).length / 1024)
  console.log(`\nWrote ${OUTPUT} (${sizeKB} KB, ${people.length} entries)`)
}

main().catch(console.error)
