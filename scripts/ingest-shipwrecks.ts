/**
 * Script to ingest Roman shipwreck data from the DARMC (Digital Atlas of
 * Roman and Medieval Civilizations) at Harvard Dataverse and merge with
 * existing hand-curated shipwreck data.
 *
 * Usage: npx tsx scripts/ingest-shipwrecks.ts
 */

import { readFile, writeFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import * as XLSX from 'xlsx'

interface Shipwreck {
  id: string
  name: string
  lat: number
  lng: number
  startYear: number
  endYear: number
  cargoType: string | null
  depth: number | null
  description: string
  source: string
}

const SHIPWRECKS_PATH = fileURLToPath(
  new URL('../src/data/shipwrecks/shipwrecks.json', import.meta.url),
)

// Proximity threshold for deduplication (in degrees, ~1.1 km)
const DEDUP_THRESHOLD = 0.01

/**
 * Try multiple approaches to fetch DARMC shipwreck data.
 * Returns parsed rows as string[][] (header + data rows) or null.
 */
async function fetchDARMCData(): Promise<string[][] | null> {
  // Step 1: Get dataset metadata to find the file ID
  const metadataUrls = [
    {
      url: 'https://dataverse.harvard.edu/api/datasets/:persistentId?persistentId=doi:10.7910/DVN/ZIQPDG',
      label: 'Dataverse dataset metadata (DVN/ZIQPDG)',
    },
    {
      url: 'https://dataverse.harvard.edu/api/datasets/:persistentId?persistentId=doi:10.7910/DVN/WMI93F',
      label: 'DARMC GIS dataset (DVN/WMI93F)',
    },
  ]

  // Collect candidate file IDs from metadata
  const candidateFileIds: Array<{ id: number; name: string }> = []

  for (const { url, label } of metadataUrls) {
    try {
      console.log(`  Trying ${label}...`)
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      })
      console.log(`    Status: ${res.status}`)

      if (!res.ok) continue

      const json = await res.json()
      const files = json.data?.latestVersion?.files || []
      console.log(`    Found ${files.length} files in dataset`)

      for (const file of files) {
        const fname: string = file.dataFile?.filename || file.label || ''
        const fid: number = file.dataFile?.id
        console.log(`      File: ${fname} (id: ${fid})`)
        // Prioritize files with shipwreck/wreck in name
        if (fname.toLowerCase().includes('shipwreck') || fname.toLowerCase().includes('wreck')) {
          candidateFileIds.unshift({ id: fid, name: fname })
        } else if (fid) {
          candidateFileIds.push({ id: fid, name: fname })
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`    Error: ${msg}`)
    }
  }

  // Also try the search API
  try {
    console.log(`  Trying Dataverse search API...`)
    const res = await fetch(
      'https://dataverse.harvard.edu/api/search?q=DARMC+shipwrecks&type=file',
      { signal: AbortSignal.timeout(15000) },
    )
    if (res.ok) {
      const json = await res.json()
      const items = json.data?.items || []
      console.log(`    Found ${items.length} search results`)
      for (const item of items.slice(0, 10)) {
        const fid = item.file_id || item.entity_id
        const name = item.name || ''
        console.log(`      - ${name} (id: ${fid})`)
        if (
          fid &&
          (name.toLowerCase().includes('shipwreck') || name.toLowerCase().includes('wreck'))
        ) {
          candidateFileIds.unshift({ id: fid, name })
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log(`    Error: ${msg}`)
  }

  // Step 2: Try downloading each candidate file
  for (const { id, name } of candidateFileIds) {
    try {
      console.log(`\n  Downloading file: ${name} (id: ${id})...`)
      const res = await fetch(`https://dataverse.harvard.edu/api/access/datafile/${id}`, {
        signal: AbortSignal.timeout(30000),
      })
      if (!res.ok) {
        console.log(`    Failed: ${res.status}`)
        continue
      }

      const contentType = res.headers.get('content-type') || ''
      const buffer = Buffer.from(await res.arrayBuffer())
      console.log(`    Downloaded ${buffer.length} bytes (${contentType})`)

      // Try parsing as XLSX/XLS
      if (
        contentType.includes('spreadsheet') ||
        contentType.includes('excel') ||
        contentType.includes('octet-stream') ||
        name.endsWith('.xlsx') ||
        name.endsWith('.xls')
      ) {
        return parseXLSX(buffer)
      }

      // Try parsing as CSV
      const text = buffer.toString('utf-8')
      if (contentType.includes('csv') || name.endsWith('.csv')) {
        return text
          .split('\n')
          .filter((l) => l.trim())
          .map((l) => parseCSVLine(l))
      }

      // Try as XLSX anyway (binary detection)
      if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
        // PK header = ZIP/XLSX
        return parseXLSX(buffer)
      }
      // Try as XLS (OLE2)
      if (buffer[0] === 0xd0 && buffer[1] === 0xcf) {
        return parseXLSX(buffer)
      }

      // Fallback: try CSV-like parsing
      if (text.includes(',') && text.split('\n').length > 2) {
        const lines = text.split('\n').filter((l) => l.trim())
        const hasCoords = lines.slice(0, 5).some((l) => /\d+\.\d+/.test(l))
        if (hasCoords) {
          return lines.map((l) => parseCSVLine(l))
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`    Error: ${msg}`)
    }
  }

  return null
}

/**
 * Parse an XLSX/XLS buffer into rows using the xlsx library.
 */
function parseXLSX(buffer: Buffer): string[][] | null {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    console.log(`    Sheets: ${workbook.SheetNames.join(', ')}`)

    // Try each sheet to find one with coordinate data
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const rows: string[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
        raw: false,
      }) as string[][]

      if (rows.length < 2) continue

      console.log(`    Sheet "${sheetName}": ${rows.length} rows, ${rows[0]?.length || 0} columns`)
      console.log(`    Headers: ${(rows[0] || []).join(', ')}`)

      // Check if headers contain lat/lng-like columns
      const headers = (rows[0] || []).map((h: string) => String(h).toLowerCase())
      const hasCoords =
        headers.some((h) => /lat/i.test(h) || h === 'y') &&
        headers.some((h) => /lon/i.test(h) || /lng/i.test(h) || h === 'x')

      if (hasCoords) {
        console.log(`    Found coordinate columns in sheet "${sheetName}"`)
        return rows.map((r) => r.map((c) => String(c)))
      }
    }

    // If no sheet has obvious coord headers, return the first sheet with the most rows
    let bestSheet = workbook.SheetNames[0]
    let bestRows: string[][] = []
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const rows: string[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
        raw: false,
      }) as string[][]
      if (rows.length > bestRows.length) {
        bestRows = rows
        bestSheet = sheetName
      }
    }

    if (bestRows.length > 1) {
      console.log(`    Using sheet "${bestSheet}" with ${bestRows.length} rows`)
      return bestRows.map((r) => r.map((c) => String(c)))
    }

    return null
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log(`    XLSX parse error: ${msg}`)
    return null
  }
}

/**
 * Parse tabular rows that may contain shipwreck records.
 * Tries to be flexible about column names.
 */
function parseRows(rows: string[][]): Shipwreck[] {
  if (rows.length < 2) return []

  // Parse header
  const header = rows[0].map((h) => h.toLowerCase().trim())
  console.log(`  Headers: ${header.join(', ')}`)

  // Find relevant columns (flexible matching for DARMC and other formats)
  const latCol = header.findIndex(
    (h) => h === 'lat' || h === 'latitude' || h === 'y' || h === 'lat_dd',
  )
  const lngCol = header.findIndex(
    (h) =>
      h === 'lng' ||
      h === 'lon' ||
      h === 'longitude' ||
      h === 'long' ||
      h === 'x' ||
      h === 'lon_dd',
  )
  const nameCol = header.findIndex(
    (h) =>
      h === 'name' || h === 'site' || h === 'site_name' || h === 'wreck_name' || h === 'location',
  )
  const dateCol = header.findIndex(
    (h) =>
      h === 'date' ||
      h === 'period' ||
      h === 'dating' ||
      h === 'start_date' ||
      h === 'start date' ||
      h === 'min_date' ||
      h === 'year',
  )
  const endDateCol = header.findIndex(
    (h) => h === 'end_date' || h === 'end date' || h === 'max_date' || h === 'end_year',
  )
  const cargoCol = header.findIndex(
    (h) => h === 'cargo' || h === 'cargo_type' || h === 'contents' || h === 'cargo 1',
  )
  const depthCol = header.findIndex((h) => h === 'depth' || h === 'depth_m')
  const descCol = header.findIndex((h) => h === 'description' || h === 'notes' || h === 'comments')

  if (latCol === -1 || lngCol === -1) {
    console.log('  Could not find lat/lng columns')
    return []
  }

  console.log(
    `  Column mapping: lat=${latCol}, lng=${lngCol}, name=${nameCol}, date=${dateCol}, cargo=${cargoCol}`,
  )

  const wrecks: Shipwreck[] = []

  for (let i = 1; i < rows.length; i++) {
    const fields = rows[i]
    if (fields.length <= Math.max(latCol, lngCol)) continue

    const lat = parseFloat(fields[latCol])
    const lng = parseFloat(fields[lngCol])
    if (isNaN(lat) || isNaN(lng)) continue
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue

    // Filter to Mediterranean / Roman world roughly
    if (lat < 20 || lat > 60 || lng < -15 || lng > 50) continue

    const name =
      nameCol >= 0
        ? fields[nameCol]?.trim() || `DARMC Wreck at ${lat.toFixed(2)}, ${lng.toFixed(2)}`
        : `DARMC Wreck at ${lat.toFixed(2)}, ${lng.toFixed(2)}`

    const { startYear, endYear } = parseDateRange(
      dateCol >= 0 ? fields[dateCol] : '',
      endDateCol >= 0 ? fields[endDateCol] : '',
    )

    const cargo = cargoCol >= 0 ? normalizeCargoType(fields[cargoCol]) : null
    const depth = depthCol >= 0 ? parseFloat(fields[depthCol]) || null : null
    const desc =
      descCol >= 0 ? fields[descCol]?.trim() || 'From DARMC database' : 'From DARMC database'

    const id = `darmc-wreck-${i}`

    wrecks.push({
      id,
      name,
      lat: Math.round(lat * 10000) / 10000,
      lng: Math.round(lng * 10000) / 10000,
      startYear,
      endYear,
      cargoType: cargo,
      depth,
      description: desc,
      source: 'DARMC',
    })
  }

  return wrecks
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}

function parseDateRange(startStr: string, endStr: string): { startYear: number; endYear: number } {
  // Default to broad Roman period
  let startYear = -200
  let endYear = 400

  if (startStr) {
    const cleaned = startStr.trim()

    // Handle "100 BC" or "-100"
    const bcMatch = cleaned.match(/^(\d+)\s*BC$/i)
    if (bcMatch) {
      startYear = -parseInt(bcMatch[1], 10)
    } else {
      const num = parseInt(cleaned, 10)
      if (!isNaN(num) && num >= -800 && num <= 600) {
        startYear = num
      }
    }
  }

  if (endStr) {
    const cleaned = endStr.trim()
    const bcMatch = cleaned.match(/^(\d+)\s*BC$/i)
    if (bcMatch) {
      endYear = -parseInt(bcMatch[1], 10)
    } else {
      const num = parseInt(cleaned, 10)
      if (!isNaN(num) && num >= -800 && num <= 600) {
        endYear = num
      }
    }
  }

  // If only start is set, give a 50-year window
  if (startStr && !endStr) {
    endYear = startYear + 50
  }
  // If only end is set, give a 50-year window before
  if (!startStr && endStr) {
    startYear = endYear - 50
  }

  // Ensure start <= end
  if (startYear > endYear) {
    ;[startYear, endYear] = [endYear, startYear]
  }

  return { startYear, endYear }
}

function normalizeCargoType(raw: string | undefined): string | null {
  if (!raw) return null
  const lower = raw.toLowerCase().trim()
  if (!lower) return null

  if (
    lower.includes('nothing') ||
    lower.includes('unknown') ||
    lower.includes('n/a') ||
    lower.includes('none')
  )
    return null
  if (lower.includes('amphora') || lower.includes('amphorae')) return 'amphora'
  if (lower.includes('marble')) return 'marble'
  if (lower.includes('grain') || lower.includes('wheat') || lower.includes('cereal')) return 'grain'
  if (
    lower.includes('metal') ||
    lower.includes('copper') ||
    lower.includes('tin') ||
    lower.includes('lead') ||
    lower.includes('iron')
  )
    return 'metal'
  if (lower.includes('wine')) return 'amphora'
  if (lower.includes('oil') || lower.includes('olive')) return 'amphora'
  if (lower.includes('pottery') || lower.includes('ceramic')) return 'pottery'
  if (lower.includes('glass')) return 'glass'
  if (lower.includes('stone') || lower.includes('column') || lower.includes('sarcophag'))
    return 'stone'
  if (lower.includes('mix') || lower.includes('various')) return 'mixed'

  return lower.length > 20 ? 'mixed' : lower
}

/**
 * Check if a wreck is too close to an existing one (deduplication).
 */
function isDuplicate(wreck: Shipwreck, existing: Shipwreck[], threshold: number): boolean {
  return existing.some(
    (e) => Math.abs(e.lat - wreck.lat) < threshold && Math.abs(e.lng - wreck.lng) < threshold,
  )
}

async function main() {
  console.log('Ingesting shipwreck data from DARMC...\n')

  // 1. Read existing shipwrecks
  let existing: Shipwreck[] = []
  try {
    const raw = await readFile(SHIPWRECKS_PATH, 'utf-8')
    existing = JSON.parse(raw)
    console.log(`  Loaded ${existing.length} existing shipwrecks`)
  } catch {
    console.log('  No existing shipwrecks file found, starting fresh')
  }

  // 2. Try to fetch DARMC data
  console.log('\nAttempting to fetch DARMC data...')
  const data = await fetchDARMCData()

  if (!data) {
    console.log('\n  Could not download DARMC shipwreck data from Harvard Dataverse.')
    console.log('  The dataset may require manual download or may be in a geodatabase format')
    console.log('  that cannot be read as CSV/text.')
    console.log(
      '\n  The DARMC shipwreck data is typically distributed as an ESRI Geodatabase (.gdb)',
    )
    console.log('  which requires specialized tools (GDAL/ogr2ogr) to convert to CSV/GeoJSON.')
    console.log('\n  Keeping existing data unchanged.')
    console.log(`  Existing shipwrecks: ${existing.length}`)
    return
  }

  // 3. Parse the downloaded data
  console.log('\nParsing downloaded data...')
  const darmcWrecks = parseRows(data)
  console.log(`  Parsed ${darmcWrecks.length} DARMC shipwrecks`)

  if (darmcWrecks.length === 0) {
    console.log('  No valid shipwreck records found in downloaded data.')
    console.log('  Keeping existing data unchanged.')
    return
  }

  // 4. Merge with deduplication
  console.log('\nMerging with existing data...')
  let added = 0
  let skipped = 0

  for (const wreck of darmcWrecks) {
    if (isDuplicate(wreck, existing, DEDUP_THRESHOLD)) {
      skipped++
    } else {
      existing.push(wreck)
      added++
    }
  }

  console.log(`  Added: ${added}`)
  console.log(`  Skipped (duplicates): ${skipped}`)
  console.log(`  Total shipwrecks: ${existing.length}`)

  // 5. Write merged result
  const json = JSON.stringify(existing, null, 2)
  await writeFile(SHIPWRECKS_PATH, json + '\n')
  console.log(`\n  Written to ${SHIPWRECKS_PATH}`)
  console.log(`  File size: ${(json.length / 1024).toFixed(1)} KB`)

  // Stats
  const sources = new Map<string, number>()
  for (const w of existing) {
    sources.set(w.source, (sources.get(w.source) || 0) + 1)
  }
  console.log('\n  By source:')
  for (const [source, count] of sources) {
    console.log(`    ${source}: ${count}`)
  }

  console.log('\nShipwreck ingestion complete')
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
