/**
 * Script to ingest ancient port data from the Ancient Ports & Harbours database
 * (ancientportsantiques.com) and produce a standardized JSON dataset.
 *
 * Approach:
 *   1. Try downloading the Excel database from the site
 *   2. If that fails, fall back to a comprehensive curated dataset of ~300 major
 *      ancient Mediterranean ports with accurate coordinates
 *
 * Usage: npx tsx scripts/ingest-ancient-ports.ts
 */

import { writeFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import * as XLSX from 'xlsx'

interface AncientPort {
  id: string
  name: string
  lat: number
  lng: number
  portType: 'major_port' | 'port' | 'harbour' | 'anchorage' | 'lighthouse' | 'shipyard'
  description: string
  startYear: number
  endYear: number
  source: string
}

const OUTPUT_PATH = fileURLToPath(new URL('../src/data/ancient-ports.json', import.meta.url))

// Proximity threshold for deduplication (in degrees, ~1.1 km)
const DEDUP_THRESHOLD = 0.01

// Excel download URL from the catalogue page
const XLSX_URL =
  'https://www.ancientportsantiques.com/wp-content/uploads/Documents/GE/AncientPorts.xlsx'

// ────────────────────────────────────────────────────────────────────────────
// Download & parse the remote Excel file
// ────────────────────────────────────────────────────────────────────────────

async function fetchExcelData(): Promise<string[][] | null> {
  console.log(`  Fetching Excel file from ${XLSX_URL} ...`)
  try {
    const res = await fetch(XLSX_URL, {
      signal: AbortSignal.timeout(30_000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ancient-rome-research-bot/1.0)',
      },
    })
    console.log(`    Status: ${res.status}`)
    if (!res.ok) return null

    const buffer = Buffer.from(await res.arrayBuffer())
    console.log(`    Downloaded ${(buffer.length / 1024).toFixed(0)} KB`)

    return parseXLSX(buffer)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log(`    Error: ${msg}`)
    return null
  }
}

function parseXLSX(buffer: Buffer): string[][] | null {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    console.log(`    Sheets: ${workbook.SheetNames.join(', ')}`)

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const rows: string[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
        raw: false,
      }) as string[][]

      if (rows.length < 2) continue

      console.log(`    Sheet "${sheetName}": ${rows.length} rows, ${rows[0]?.length || 0} columns`)
      console.log(`    Headers: ${(rows[0] || []).slice(0, 12).join(' | ')}`)

      // Look for coordinate columns
      const headers = (rows[0] || []).map((h: string) => String(h).toLowerCase().trim())
      const hasCoords =
        headers.some((h) => /lat/i.test(h) || h === 'y') &&
        headers.some((h) => /lon/i.test(h) || /lng/i.test(h) || h === 'x')

      if (hasCoords) {
        console.log(`    Found coordinate columns in sheet "${sheetName}"`)
        return rows.map((r) => r.map((c) => String(c)))
      }
    }

    // Fallback: use the sheet with the most rows
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
      console.log(`    Headers: ${(bestRows[0] || []).slice(0, 12).join(' | ')}`)
      return bestRows.map((r) => r.map((c) => String(c)))
    }
    return null
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log(`    XLSX parse error: ${msg}`)
    return null
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Parse tabular rows from the Excel data into AncientPort records
// ────────────────────────────────────────────────────────────────────────────

function parseRows(rows: string[][]): AncientPort[] {
  if (rows.length < 2) return []

  const header = rows[0].map((h) => h.toLowerCase().trim())
  console.log(`  All headers: ${header.join(' | ')}`)

  // Find relevant columns
  const latCol = header.findIndex(
    (h) => h === 'lat' || h === 'latitude' || h === 'y' || h === 'lat_dd' || h.includes('lat'),
  )
  const lngCol = header.findIndex(
    (h) =>
      h === 'lng' ||
      h === 'lon' ||
      h === 'longitude' ||
      h === 'long' ||
      h === 'x' ||
      h === 'lon_dd' ||
      h.includes('lon'),
  )
  const nameCol = header.findIndex(
    (h) =>
      h === 'name' ||
      h === 'site' ||
      h === 'site_name' ||
      h === 'port' ||
      h === 'port_name' ||
      h === 'location' ||
      h === 'place',
  )
  const nameModCol = header.findIndex((h) => h === 'name_mod')
  const countryCol = header.findIndex((h) => h === 'country' || h === 'region' || h === 'area')
  const foundationCol = header.findIndex((h) => h === 'foundation')

  // Infrastructure columns from the APA database (port features)
  // These help classify port type more accurately
  const phCol = header.findIndex((h) => h === 'ph') // Pharos/lighthouse
  const shCol = header.findIndex((h) => h === 'sh') // Shipyard
  const syCol = header.findIndex((h) => h === 'sy') // Shipyard (alt)
  const bwCol = header.findIndex((h) => h === 'bw') // Breakwater
  const moCol = header.findIndex((h) => h === 'mo') // Mole
  const quCol = header.findIndex((h) => h === 'qu') // Quay
  const slCol = header.findIndex((h) => h === 'sl') // Slipway

  // Period columns (civilization markers)
  const grCol = header.findIndex((h) => h === 'gr') // Greek
  const roCol = header.findIndex((h) => h === 'ro') // Roman
  const pnCol = header.findIndex((h) => h === 'pn') // Phoenician
  const egCol = header.findIndex((h) => h === 'eg') // Egyptian
  const heCol = header.findIndex((h) => h === 'he') // Hellenistic
  const byCol = header.findIndex((h) => h === 'by') // Byzantine

  if (latCol === -1 || lngCol === -1) {
    console.log('  Could not find lat/lng columns, trying numeric detection...')
    return []
  }

  console.log(
    `  Column map: lat=${latCol}, lng=${lngCol}, name=${nameCol}, country=${countryCol}, foundation=${foundationCol}`,
  )
  console.log(
    `  Infrastructure: ph=${phCol}, sh=${shCol}, bw=${bwCol}, mo=${moCol}, qu=${quCol}, sl=${slCol}`,
  )
  console.log(
    `  Periods: gr=${grCol}, ro=${roCol}, pn=${pnCol}, eg=${egCol}, he=${heCol}, by=${byCol}`,
  )

  const ports: AncientPort[] = []
  let skippedCoords = 0
  let skippedBounds = 0

  // Known major ports for classification
  const majorPortNames = new Set([
    'alexandria',
    'carthage',
    'ostia',
    'portus',
    'piraeus',
    'rhodes',
    'ephesus',
    'antioch',
    'caesarea',
    'leptis magna',
    'massilia',
    'puteoli',
    'brundisium',
    'ravenna',
    'thessalonica',
    'corinth',
    'delos',
    'byzantium',
    'constantinople',
    'syracuse',
    'tyre',
    'sidon',
    'gades',
    'tarraco',
    'narbo',
    'aquileia',
    'salona',
    'smyrna',
    'miletus',
    'attaleia',
    'seleucia',
    'neapolis',
    'carthago nova',
    'sinope',
    'tomis',
    'panormus',
    'dyrrachium',
    'londinium',
    'burdigala',
    'arelate',
    'gesoriacum',
    'berenice',
  ])

  for (let i = 1; i < rows.length; i++) {
    const fields = rows[i]
    if (fields.length <= Math.max(latCol, lngCol)) continue

    const lat = parseFloat(fields[latCol])
    const lng = parseFloat(fields[lngCol])
    if (isNaN(lat) || isNaN(lng)) {
      skippedCoords++
      continue
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      skippedBounds++
      continue
    }

    // Broad Roman world filter (allow generous bounds)
    if (lat < 10 || lat > 65 || lng < -20 || lng > 55) continue

    const rawName =
      nameCol >= 0
        ? fields[nameCol]?.trim() || `Port at ${lat.toFixed(2)}, ${lng.toFixed(2)}`
        : `Port at ${lat.toFixed(2)}, ${lng.toFixed(2)}`

    const modernName = nameModCol >= 0 ? fields[nameModCol]?.trim() : ''
    const country = countryCol >= 0 ? fields[countryCol]?.trim() : ''
    const foundation = foundationCol >= 0 ? fields[foundationCol]?.trim() : ''

    // Determine port type from infrastructure columns
    const hasLighthouse = phCol >= 0 && fields[phCol]?.trim() !== ''
    const hasShipyard =
      (shCol >= 0 && fields[shCol]?.trim() !== '') || (syCol >= 0 && fields[syCol]?.trim() !== '')
    const hasBreakwater = bwCol >= 0 && fields[bwCol]?.trim() !== ''
    const hasMole = moCol >= 0 && fields[moCol]?.trim() !== ''
    const hasQuay = quCol >= 0 && fields[quCol]?.trim() !== ''
    const hasSlipway = slCol >= 0 && fields[slCol]?.trim() !== ''

    // Count infrastructure features
    const infraCount = [
      hasBreakwater,
      hasMole,
      hasQuay,
      hasSlipway,
      hasLighthouse,
      hasShipyard,
    ].filter(Boolean).length

    // Classify port type
    let portType: AncientPort['portType'] = 'port'
    const nameLower = rawName.toLowerCase()

    if (hasLighthouse && !hasShipyard && infraCount <= 1) {
      portType = 'lighthouse'
    } else if (hasShipyard && infraCount <= 2) {
      portType = 'shipyard'
    } else if (majorPortNames.has(nameLower) || infraCount >= 3) {
      portType = 'major_port'
    } else if (nameLower.includes('anchorage') || nameLower.includes('roadstead')) {
      portType = 'anchorage'
    } else if (
      nameLower.includes('harbour') ||
      nameLower.includes('harbor') ||
      nameLower.includes('cove') ||
      nameLower.includes('inlet') ||
      (infraCount === 0 && !hasBreakwater && !hasMole)
    ) {
      portType = 'harbour'
    } else {
      portType = 'port'
    }

    // Determine date range from period markers and foundation
    const isGreek = grCol >= 0 && fields[grCol]?.trim() !== ''
    const isRoman = roCol >= 0 && fields[roCol]?.trim() !== ''
    const isPhoenician = pnCol >= 0 && fields[pnCol]?.trim() !== ''
    const isEgyptian = egCol >= 0 && fields[egCol]?.trim() !== ''
    const isHellenistic = heCol >= 0 && fields[heCol]?.trim() !== ''
    const isByzantine = byCol >= 0 && fields[byCol]?.trim() !== ''

    let startYear = -300
    let endYear = 476

    // Use civilization markers to narrow date range
    if (isPhoenician || isEgyptian) startYear = -800
    else if (isGreek) startYear = -600
    else if (isHellenistic) startYear = -323
    else if (isRoman) startYear = -200

    if (isByzantine) endYear = 700
    else if (isRoman) endYear = 476
    else if (isHellenistic) endYear = -31
    else if (isGreek && !isRoman) endYear = -146

    // Override with foundation date if available
    if (foundation) {
      const parsed = parseDateRange(foundation)
      if (parsed.startYear !== -300) {
        startYear = parsed.startYear
      }
    }

    // Ensure start < end
    if (startYear >= endYear) endYear = startYear + 200

    // Build description
    const features: string[] = []
    if (hasBreakwater) features.push('breakwater')
    if (hasMole) features.push('mole')
    if (hasQuay) features.push('quay')
    if (hasSlipway) features.push('slipway')
    if (hasLighthouse) features.push('lighthouse')
    if (hasShipyard) features.push('shipyard')

    const parts = [
      `Ancient ${portType.replace('_', ' ')}`,
      modernName ? `(modern: ${modernName})` : '',
      country ? `in ${country}` : '',
      features.length > 0 ? `- features: ${features.join(', ')}` : '',
    ].filter(Boolean)

    const description = parts.join(' ')

    const id = `apa-${slugify(rawName)}-${i}`

    ports.push({
      id,
      name: rawName,
      lat: Math.round(lat * 10000) / 10000,
      lng: Math.round(lng * 10000) / 10000,
      portType,
      description,
      startYear,
      endYear,
      source: 'ancientportsantiques.com',
    })
  }

  console.log(
    `  Parsed ${ports.length} ports (skipped ${skippedCoords} no-coord, ${skippedBounds} out-of-bounds)`,
  )
  return ports
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

function parseDateRange(period: string): {
  startYear: number
  endYear: number
} {
  if (!period || !period.trim()) return { startYear: -300, endYear: 476 }

  const lower = period.toLowerCase()

  // Period name matching
  if (lower.includes('bronze')) return { startYear: -1500, endYear: -800 }
  if (lower.includes('archaic')) return { startYear: -800, endYear: -500 }
  if (lower.includes('classical') || lower.includes('greek'))
    return { startYear: -500, endYear: -146 }
  if (lower.includes('hellenistic')) return { startYear: -323, endYear: -31 }
  if (lower.includes('roman') && lower.includes('republic'))
    return { startYear: -509, endYear: -27 }
  if (lower.includes('roman') && lower.includes('imperial')) return { startYear: -27, endYear: 284 }
  if (lower.includes('roman')) return { startYear: -200, endYear: 400 }
  if (lower.includes('byzantine')) return { startYear: 330, endYear: 700 }
  if (lower.includes('medieval')) return { startYear: 476, endYear: 1000 }

  // Try numeric parsing
  const bcMatch = period.match(/(\d+)\s*BC/i)
  if (bcMatch) {
    const yr = -parseInt(bcMatch[1], 10)
    return { startYear: yr, endYear: yr + 200 }
  }

  const adMatch = period.match(/(\d+)\s*AD/i)
  if (adMatch) {
    const yr = parseInt(adMatch[1], 10)
    return { startYear: yr - 100, endYear: yr + 100 }
  }

  // Default to broad Roman period
  return { startYear: -300, endYear: 476 }
}

// ────────────────────────────────────────────────────────────────────────────
// Curated fallback dataset of ~300 major ancient Mediterranean ports
// ────────────────────────────────────────────────────────────────────────────

function getCuratedPorts(): AncientPort[] {
  const ports: Array<Omit<AncientPort, 'id' | 'source'> & { id?: string }> = [
    // ── Italy ──────────────────────────────────────────────────────────
    {
      name: 'Ostia',
      lat: 41.7556,
      lng: 12.2856,
      portType: 'major_port',
      description: "Rome's primary maritime port at the Tiber mouth",
      startYear: -400,
      endYear: 476,
    },
    {
      name: 'Portus',
      lat: 41.7803,
      lng: 12.2583,
      portType: 'major_port',
      description: "Trajan's hexagonal harbour complex near Ostia",
      startYear: 42,
      endYear: 550,
    },
    {
      name: 'Puteoli (Pozzuoli)',
      lat: 40.8223,
      lng: 14.1231,
      portType: 'major_port',
      description: "Major commercial port of Campania, Rome's chief import harbour before Portus",
      startYear: -194,
      endYear: 476,
    },
    {
      name: 'Brundisium (Brindisi)',
      lat: 40.6376,
      lng: 17.9467,
      portType: 'major_port',
      description: 'Key embarkation port for the eastern Mediterranean via the Via Appia',
      startYear: -244,
      endYear: 476,
    },
    {
      name: 'Ravenna',
      lat: 44.4184,
      lng: 12.2035,
      portType: 'major_port',
      description: 'Base of the Classis Ravennatis, Roman Adriatic fleet',
      startYear: -27,
      endYear: 540,
    },
    {
      name: 'Tarentum (Taranto)',
      lat: 40.4637,
      lng: 17.2468,
      portType: 'major_port',
      description: 'Major Greek and Roman port on the Gulf of Taranto',
      startYear: -706,
      endYear: 476,
    },
    {
      name: 'Neapolis (Naples)',
      lat: 40.8358,
      lng: 14.2488,
      portType: 'major_port',
      description: 'Major port of Campania with deep Greek heritage',
      startYear: -600,
      endYear: 476,
    },
    {
      name: 'Misenum',
      lat: 40.786,
      lng: 14.0842,
      portType: 'major_port',
      description: 'Base of the Classis Misenensis, main Roman western fleet',
      startYear: -27,
      endYear: 476,
    },
    {
      name: 'Baiae',
      lat: 40.8131,
      lng: 14.0789,
      portType: 'harbour',
      description: 'Luxury resort harbour of the Roman elite, now partially submerged',
      startYear: -100,
      endYear: 400,
    },
    {
      name: 'Regium (Reggio Calabria)',
      lat: 38.1113,
      lng: 15.6473,
      portType: 'port',
      description: 'Port controlling the Strait of Messina',
      startYear: -720,
      endYear: 476,
    },
    {
      name: 'Ancona',
      lat: 43.6158,
      lng: 13.5184,
      portType: 'port',
      description: "Adriatic port with Trajan's arch marking the harbour entrance",
      startYear: -387,
      endYear: 476,
    },
    {
      name: 'Aquileia',
      lat: 45.7681,
      lng: 13.3688,
      portType: 'major_port',
      description: 'Major Roman river port and gateway to the northeastern frontier',
      startYear: -181,
      endYear: 452,
    },
    {
      name: 'Genua (Genoa)',
      lat: 44.4056,
      lng: 8.9463,
      portType: 'port',
      description: 'Ligurian port and Roman ally during the Punic Wars',
      startYear: -218,
      endYear: 476,
    },
    {
      name: 'Pisae (Pisa)',
      lat: 43.7228,
      lng: 10.4017,
      portType: 'port',
      description: 'Etruscan and Roman river port near the Arno mouth',
      startYear: -600,
      endYear: 476,
    },
    {
      name: 'Luna (Luni)',
      lat: 44.0714,
      lng: 10.04,
      portType: 'port',
      description: 'Port for Carrara marble export',
      startYear: -177,
      endYear: 476,
    },
    {
      name: 'Centumcellae (Civitavecchia)',
      lat: 42.093,
      lng: 11.7869,
      portType: 'port',
      description: "Trajan's purpose-built harbour north of Rome",
      startYear: 106,
      endYear: 476,
    },
    {
      name: 'Cosa',
      lat: 42.4089,
      lng: 11.2886,
      portType: 'harbour',
      description: 'Roman colony with harbour on the Tuscan coast',
      startYear: -273,
      endYear: 200,
    },
    {
      name: 'Ariminum (Rimini)',
      lat: 44.0594,
      lng: 12.5683,
      portType: 'port',
      description: 'Adriatic terminus of the Via Flaminia',
      startYear: -268,
      endYear: 476,
    },
    {
      name: 'Salernum (Salerno)',
      lat: 40.6824,
      lng: 14.7681,
      portType: 'port',
      description: 'Roman colony and port on the Tyrrhenian Sea',
      startYear: -197,
      endYear: 476,
    },
    {
      name: 'Croton',
      lat: 39.0809,
      lng: 17.1273,
      portType: 'port',
      description: 'Ancient Greek colony and port in Magna Graecia',
      startYear: -710,
      endYear: 476,
    },
    {
      name: 'Velia (Elea)',
      lat: 40.1619,
      lng: 15.1531,
      portType: 'harbour',
      description: 'Greek philosophical colony with well-preserved harbour',
      startYear: -535,
      endYear: 400,
    },

    // ── Sicily ─────────────────────────────────────────────────────────
    {
      name: 'Syracuse (Siracusa)',
      lat: 37.0755,
      lng: 15.2866,
      portType: 'major_port',
      description: 'Great Greek and Roman port, one of the largest cities of antiquity',
      startYear: -734,
      endYear: 476,
    },
    {
      name: 'Panormus (Palermo)',
      lat: 38.1157,
      lng: 13.3615,
      portType: 'major_port',
      description: 'Phoenician and Roman port, capital of Sicily under Roman rule',
      startYear: -734,
      endYear: 476,
    },
    {
      name: 'Messana (Messina)',
      lat: 38.1938,
      lng: 15.554,
      portType: 'port',
      description: 'Strategic port controlling the strait between Italy and Sicily',
      startYear: -730,
      endYear: 476,
    },
    {
      name: 'Lilybaeum (Marsala)',
      lat: 37.7982,
      lng: 12.4349,
      portType: 'port',
      description: 'Western Sicilian port, major base during the Punic Wars',
      startYear: -397,
      endYear: 476,
    },
    {
      name: 'Agrigentum (Agrigento)',
      lat: 37.29,
      lng: 13.5889,
      portType: 'port',
      description: 'Emporion of the wealthy Greek colony at Akragas',
      startYear: -580,
      endYear: 476,
    },
    {
      name: 'Catana (Catania)',
      lat: 37.5079,
      lng: 15.083,
      portType: 'port',
      description: 'Greek and Roman port at the foot of Mount Etna',
      startYear: -729,
      endYear: 476,
    },

    // ── Sardinia & Corsica ─────────────────────────────────────────────
    {
      name: 'Caralis (Cagliari)',
      lat: 39.2238,
      lng: 9.1217,
      portType: 'major_port',
      description: 'Capital and main port of Roman Sardinia',
      startYear: -238,
      endYear: 476,
    },
    {
      name: 'Turris Libisonis (Porto Torres)',
      lat: 40.838,
      lng: 8.4019,
      portType: 'port',
      description: 'Roman colony and port in northern Sardinia',
      startYear: -46,
      endYear: 476,
    },
    {
      name: 'Aleria',
      lat: 42.105,
      lng: 9.5119,
      portType: 'port',
      description: 'Main Roman port of Corsica',
      startYear: -259,
      endYear: 476,
    },

    // ── Greece & Aegean ────────────────────────────────────────────────
    {
      name: 'Piraeus',
      lat: 37.9475,
      lng: 23.6467,
      portType: 'major_port',
      description: 'The great port of Athens with three harbours: Kantharos, Zea, and Munichia',
      startYear: -493,
      endYear: 476,
    },
    {
      name: 'Corinth (Lechaion)',
      lat: 37.9191,
      lng: 22.884,
      portType: 'major_port',
      description: 'Western harbour of Corinth on the Gulf of Corinth',
      startYear: -700,
      endYear: 476,
    },
    {
      name: 'Corinth (Kenchreai)',
      lat: 37.8833,
      lng: 22.9917,
      portType: 'port',
      description: 'Eastern harbour of Corinth on the Saronic Gulf',
      startYear: -700,
      endYear: 476,
    },
    {
      name: 'Thessalonica',
      lat: 40.6401,
      lng: 22.9444,
      portType: 'major_port',
      description: 'Major Macedonian port on the Thermaic Gulf, capital of Roman Macedonia',
      startYear: -315,
      endYear: 476,
    },
    {
      name: 'Delos',
      lat: 37.3964,
      lng: 25.27,
      portType: 'major_port',
      description: 'Sacred island and the greatest free port of the Hellenistic world',
      startYear: -478,
      endYear: 69,
    },
    {
      name: 'Rhodes',
      lat: 36.451,
      lng: 28.2278,
      portType: 'major_port',
      description: 'Great maritime republic, site of the Colossus',
      startYear: -408,
      endYear: 476,
    },
    {
      name: 'Patras',
      lat: 38.2466,
      lng: 21.7346,
      portType: 'port',
      description: 'Major Roman colony and port in the western Peloponnese',
      startYear: -600,
      endYear: 476,
    },
    {
      name: 'Eleusis',
      lat: 38.0417,
      lng: 23.5392,
      portType: 'harbour',
      description: 'Sacred harbour near Athens linked to the Eleusinian Mysteries',
      startYear: -600,
      endYear: 395,
    },
    {
      name: 'Amphipolis',
      lat: 40.8206,
      lng: 23.8547,
      portType: 'port',
      description: 'Strategic port at the mouth of the Strymon river',
      startYear: -437,
      endYear: 476,
    },
    {
      name: 'Nicopolis',
      lat: 38.9583,
      lng: 20.7153,
      portType: 'port',
      description: 'Augustan victory city with harbour on the Ambracian Gulf',
      startYear: -31,
      endYear: 476,
    },
    {
      name: 'Apollonia (Illyria)',
      lat: 40.7167,
      lng: 19.4833,
      portType: 'port',
      description: 'Western terminus of the Via Egnatia on the Adriatic coast',
      startYear: -588,
      endYear: 476,
    },
    {
      name: 'Dyrrachium (Durres)',
      lat: 41.3246,
      lng: 19.4565,
      portType: 'major_port',
      description: 'Eastern Adriatic terminus of the Via Egnatia, key crossing to Brundisium',
      startYear: -627,
      endYear: 476,
    },
    {
      name: 'Cnossos (Heraklion)',
      lat: 35.3387,
      lng: 25.1442,
      portType: 'port',
      description: "Port serving Crete's most important city",
      startYear: -700,
      endYear: 476,
    },
    {
      name: 'Gortyna',
      lat: 35.0628,
      lng: 24.9467,
      portType: 'harbour',
      description: 'Port of the Roman capital of Crete at Lebena',
      startYear: -300,
      endYear: 476,
    },
    {
      name: 'Kydonia (Chania)',
      lat: 35.5175,
      lng: 24.0178,
      portType: 'port',
      description: 'Major port on the northwest coast of Crete',
      startYear: -500,
      endYear: 476,
    },

    // ── Asia Minor (Turkey) ────────────────────────────────────────────
    {
      name: 'Ephesus',
      lat: 37.9411,
      lng: 27.3417,
      portType: 'major_port',
      description: 'Greatest port of Roman Asia, silted up over centuries',
      startYear: -600,
      endYear: 400,
    },
    {
      name: 'Miletus',
      lat: 37.5303,
      lng: 27.2778,
      portType: 'major_port',
      description: 'Ancient Ionian port city, mother of many colonies',
      startYear: -700,
      endYear: 300,
    },
    {
      name: 'Smyrna (Izmir)',
      lat: 38.4189,
      lng: 27.1287,
      portType: 'major_port',
      description: 'Major Ionian port, one of the great cities of Roman Asia',
      startYear: -600,
      endYear: 476,
    },
    {
      name: 'Pergamum (Elaia)',
      lat: 38.95,
      lng: 27.05,
      portType: 'port',
      description: 'Port serving the kingdom and city of Pergamum',
      startYear: -300,
      endYear: 476,
    },
    {
      name: 'Halicarnassus (Bodrum)',
      lat: 37.0345,
      lng: 27.4305,
      portType: 'port',
      description: 'Site of the Mausoleum, important Carian port',
      startYear: -500,
      endYear: 476,
    },
    {
      name: 'Cnidus',
      lat: 36.6881,
      lng: 27.3744,
      portType: 'port',
      description: 'Dorian port city at the tip of the Datca peninsula',
      startYear: -600,
      endYear: 400,
    },
    {
      name: 'Patara',
      lat: 36.2633,
      lng: 29.3167,
      portType: 'port',
      description: 'Lycian port and seat of the Roman provincial governor',
      startYear: -600,
      endYear: 476,
    },
    {
      name: 'Myra (Demre)',
      lat: 36.25,
      lng: 29.9833,
      portType: 'port',
      description: "Major Lycian port, Saint Paul's embarkation point",
      startYear: -500,
      endYear: 476,
    },
    {
      name: 'Side',
      lat: 36.7675,
      lng: 31.3892,
      portType: 'port',
      description: 'Pamphylian port and major slave market of the ancient world',
      startYear: -600,
      endYear: 476,
    },
    {
      name: 'Attaleia (Antalya)',
      lat: 36.8841,
      lng: 30.7056,
      portType: 'major_port',
      description: 'Attalid and Roman port, gateway to Pamphylia',
      startYear: -150,
      endYear: 476,
    },
    {
      name: 'Phaselis',
      lat: 36.5236,
      lng: 30.5531,
      portType: 'port',
      description: 'Lycian port city with three harbours',
      startYear: -690,
      endYear: 476,
    },
    {
      name: 'Tarsus',
      lat: 36.9194,
      lng: 34.8947,
      portType: 'port',
      description: 'Cilician capital and birthplace of Saint Paul, river port',
      startYear: -600,
      endYear: 476,
    },
    {
      name: 'Seleucia Pieria',
      lat: 36.1128,
      lng: 35.9322,
      portType: 'major_port',
      description: 'Port of Antioch, one of the great engineering harbours of antiquity',
      startYear: -300,
      endYear: 476,
    },
    {
      name: 'Alexandria Troas',
      lat: 39.7558,
      lng: 26.1567,
      portType: 'port',
      description: 'Major Roman port in the Troad, embarkation point for Neapolis in Macedonia',
      startYear: -310,
      endYear: 476,
    },
    {
      name: 'Cyzicus',
      lat: 40.3917,
      lng: 27.8833,
      portType: 'port',
      description: 'Major port on the Sea of Marmara with two harbours',
      startYear: -700,
      endYear: 476,
    },
    {
      name: 'Nicomedia (Izmit)',
      lat: 40.7654,
      lng: 29.9408,
      portType: 'major_port',
      description: 'Eastern capital and naval base at the head of the Gulf of Izmit',
      startYear: -264,
      endYear: 476,
    },
    {
      name: 'Chalcedon (Kadikoy)',
      lat: 40.9833,
      lng: 29.0333,
      portType: 'port',
      description: 'Port on the Bosporus opposite Byzantium',
      startYear: -685,
      endYear: 476,
    },
    {
      name: 'Byzantium (Constantinople)',
      lat: 41.0082,
      lng: 28.9784,
      portType: 'major_port',
      description: 'The Golden Horn, one of the finest natural harbours in the ancient world',
      startYear: -667,
      endYear: 476,
    },
    {
      name: 'Trapezus (Trabzon)',
      lat: 41.0027,
      lng: 39.7168,
      portType: 'port',
      description: 'Key Roman port on the southeastern Black Sea coast',
      startYear: -756,
      endYear: 476,
    },
    {
      name: 'Sinope (Sinop)',
      lat: 42.0231,
      lng: 35.1531,
      portType: 'major_port',
      description: 'Greatest Greek colony on the Black Sea, birthplace of Diogenes',
      startYear: -630,
      endYear: 476,
    },
    {
      name: 'Amisus (Samsun)',
      lat: 41.2867,
      lng: 36.33,
      portType: 'port',
      description: 'Major Black Sea port of Pontus',
      startYear: -564,
      endYear: 476,
    },
    {
      name: 'Heraclea Pontica (Karadeniz Eregli)',
      lat: 41.2828,
      lng: 31.4228,
      portType: 'port',
      description: 'Important Black Sea colony and port',
      startYear: -560,
      endYear: 476,
    },
    {
      name: 'Perge',
      lat: 36.9614,
      lng: 30.8539,
      portType: 'harbour',
      description: 'Pamphylian river port connected to the sea via the Kestros',
      startYear: -500,
      endYear: 476,
    },
    {
      name: 'Aspendos',
      lat: 36.9386,
      lng: 31.1722,
      portType: 'harbour',
      description: 'Port on the Eurymedon river in Pamphylia',
      startYear: -500,
      endYear: 400,
    },

    // ── Levant ─────────────────────────────────────────────────────────
    {
      name: 'Caesarea Maritima',
      lat: 32.5,
      lng: 34.89,
      portType: 'major_port',
      description: "Herod's engineering marvel with the largest artificial harbour of antiquity",
      startYear: -22,
      endYear: 640,
    },
    {
      name: 'Joppa (Jaffa)',
      lat: 32.0531,
      lng: 34.7507,
      portType: 'port',
      description: 'One of the oldest known harbours in the world',
      startYear: -1500,
      endYear: 476,
    },
    {
      name: 'Acre (Ptolemais)',
      lat: 32.9226,
      lng: 35.0687,
      portType: 'port',
      description: 'Ancient Phoenician and Hellenistic port in Galilee',
      startYear: -700,
      endYear: 476,
    },
    {
      name: 'Tyre',
      lat: 33.2708,
      lng: 35.1958,
      portType: 'major_port',
      description: "Great Phoenician island port, connected to mainland by Alexander's causeway",
      startYear: -2750,
      endYear: 476,
    },
    {
      name: 'Sidon',
      lat: 33.5572,
      lng: 35.3717,
      portType: 'major_port',
      description: 'Ancient Phoenician port, center of glass and purple dye production',
      startYear: -2000,
      endYear: 476,
    },
    {
      name: 'Byblos (Jbeil)',
      lat: 34.1206,
      lng: 35.6483,
      portType: 'port',
      description: 'One of the oldest continuously inhabited cities, Phoenician port',
      startYear: -3000,
      endYear: 476,
    },
    {
      name: 'Berytus (Beirut)',
      lat: 33.8938,
      lng: 35.5018,
      portType: 'port',
      description: 'Roman colony and port, home of a famous law school',
      startYear: -600,
      endYear: 476,
    },
    {
      name: 'Tripoli (Tripolis)',
      lat: 34.4367,
      lng: 35.8497,
      portType: 'port',
      description: 'Phoenician triple city and port',
      startYear: -700,
      endYear: 476,
    },
    {
      name: 'Laodicea ad Mare (Latakia)',
      lat: 35.5317,
      lng: 35.7856,
      portType: 'port',
      description: 'Seleucid and Roman port on the Syrian coast',
      startYear: -300,
      endYear: 476,
    },
    {
      name: 'Antioch (Antakya)',
      lat: 36.2028,
      lng: 36.1606,
      portType: 'port',
      description: 'Third city of the Roman Empire, river port on the Orontes',
      startYear: -300,
      endYear: 476,
    },

    // ── Egypt ──────────────────────────────────────────────────────────
    {
      name: 'Alexandria',
      lat: 31.2001,
      lng: 29.9187,
      portType: 'major_port',
      description: 'Greatest port of the ancient world, site of the Pharos lighthouse',
      startYear: -331,
      endYear: 642,
    },
    {
      name: 'Pharos Lighthouse',
      lat: 31.2139,
      lng: 29.8856,
      portType: 'lighthouse',
      description: 'One of the Seven Wonders of the Ancient World, guiding ships to Alexandria',
      startYear: -280,
      endYear: 1323,
    },
    {
      name: 'Myos Hormos (Quseir al-Qadim)',
      lat: 26.0997,
      lng: 34.2831,
      portType: 'port',
      description: 'Red Sea port for the India trade route',
      startYear: -300,
      endYear: 300,
    },
    {
      name: 'Berenice Troglodytica',
      lat: 23.9133,
      lng: 35.4783,
      portType: 'major_port',
      description: 'Ptolemaic Red Sea port for Indian Ocean trade',
      startYear: -275,
      endYear: 550,
    },
    {
      name: 'Pelusium',
      lat: 31.05,
      lng: 32.55,
      portType: 'port',
      description: 'Eastern gateway to Egypt at the Nile Delta',
      startYear: -700,
      endYear: 640,
    },
    {
      name: 'Canopus',
      lat: 31.305,
      lng: 30.0831,
      portType: 'harbour',
      description: 'Port east of Alexandria, now largely submerged',
      startYear: -600,
      endYear: 400,
    },
    {
      name: 'Paraetonium (Marsa Matruh)',
      lat: 31.3547,
      lng: 27.2453,
      portType: 'harbour',
      description: 'Natural harbour on the Libyan coast used by the Roman navy',
      startYear: -300,
      endYear: 476,
    },

    // ── North Africa (Libya, Tunisia, Algeria, Morocco) ─────────────────
    {
      name: 'Carthage',
      lat: 36.8528,
      lng: 10.3233,
      portType: 'major_port',
      description: 'Punic and Roman capital with famous circular military harbour (cothon)',
      startYear: -814,
      endYear: 698,
    },
    {
      name: 'Utica',
      lat: 36.9556,
      lng: 10.0611,
      portType: 'port',
      description: 'Oldest Phoenician colony in Africa, port silted up in antiquity',
      startYear: -1101,
      endYear: 400,
    },
    {
      name: 'Hadrumetum (Sousse)',
      lat: 35.8256,
      lng: 10.6369,
      portType: 'port',
      description: 'Phoenician and Roman port on the Tunisian coast',
      startYear: -800,
      endYear: 476,
    },
    {
      name: 'Thapsus',
      lat: 35.6153,
      lng: 11.0531,
      portType: 'harbour',
      description: "Site of Caesar's decisive victory in 46 BC",
      startYear: -600,
      endYear: 476,
    },
    {
      name: 'Leptis Magna',
      lat: 32.6378,
      lng: 14.2891,
      portType: 'major_port',
      description:
        "Septimius Severus' magnificent harbour complex, one of the best-preserved Roman ports",
      startYear: -600,
      endYear: 523,
    },
    {
      name: 'Oea (Tripoli)',
      lat: 32.9022,
      lng: 13.1897,
      portType: 'port',
      description: 'One of the three cities of Tripolitania',
      startYear: -700,
      endYear: 476,
    },
    {
      name: 'Sabratha',
      lat: 32.8025,
      lng: 12.4844,
      portType: 'port',
      description: 'Phoenician and Roman port with a famous theatre',
      startYear: -500,
      endYear: 476,
    },
    {
      name: 'Cyrene (Apollonia)',
      lat: 32.9,
      lng: 21.9667,
      portType: 'port',
      description: 'Port serving the Greek colony of Cyrene in Libya',
      startYear: -631,
      endYear: 476,
    },
    {
      name: 'Caesarea Mauretaniae (Cherchell)',
      lat: 36.6044,
      lng: 2.1931,
      portType: 'major_port',
      description: "Capital of Roman Mauretania Caesariensis with Juba II's harbour",
      startYear: -200,
      endYear: 476,
    },
    {
      name: 'Iol (Tipasa)',
      lat: 36.5897,
      lng: 2.4483,
      portType: 'port',
      description: 'Phoenician and Roman port in Mauretania',
      startYear: -600,
      endYear: 476,
    },
    {
      name: 'Hippo Regius (Annaba)',
      lat: 36.9,
      lng: 7.7667,
      portType: 'port',
      description: "Saint Augustine's bishopric, major Numidian port",
      startYear: -500,
      endYear: 476,
    },
    {
      name: 'Igilgili (Jijel)',
      lat: 36.8208,
      lng: 5.7694,
      portType: 'harbour',
      description: 'Roman port on the Algerian coast',
      startYear: -300,
      endYear: 476,
    },
    {
      name: 'Saldae (Bejaia)',
      lat: 36.75,
      lng: 5.0833,
      portType: 'port',
      description: 'Roman colony and port in Mauretania',
      startYear: -200,
      endYear: 476,
    },
    {
      name: 'Icosium (Algiers)',
      lat: 36.7538,
      lng: 3.0588,
      portType: 'port',
      description: 'Phoenician and Roman port, later capital of Algeria',
      startYear: -500,
      endYear: 476,
    },
    {
      name: 'Rusicade (Skikda)',
      lat: 36.8764,
      lng: 6.9064,
      portType: 'port',
      description: 'Roman port and colony in Numidia',
      startYear: -200,
      endYear: 476,
    },
    {
      name: 'Tingis (Tangier)',
      lat: 35.7595,
      lng: -5.834,
      portType: 'major_port',
      description: 'Port at the entrance to the Mediterranean, capital of Mauretania Tingitana',
      startYear: -500,
      endYear: 476,
    },
    {
      name: 'Lixus',
      lat: 35.1997,
      lng: -6.1067,
      portType: 'port',
      description: 'Phoenician Atlantic port in Morocco, one of the oldest in the region',
      startYear: -700,
      endYear: 476,
    },
    {
      name: 'Sala Colonia (Chellah)',
      lat: 34.0133,
      lng: -6.815,
      portType: 'harbour',
      description: 'Southernmost significant Roman Atlantic port in Morocco',
      startYear: -200,
      endYear: 280,
    },

    // ── Iberian Peninsula ──────────────────────────────────────────────
    {
      name: 'Gades (Cadiz)',
      lat: 36.5271,
      lng: -6.2886,
      portType: 'major_port',
      description: 'One of the oldest cities in Western Europe, Phoenician and Roman port',
      startYear: -1100,
      endYear: 476,
    },
    {
      name: 'Carthago Nova (Cartagena)',
      lat: 37.5986,
      lng: -0.9813,
      portType: 'major_port',
      description: 'Punic and Roman port, major silver mining center',
      startYear: -227,
      endYear: 476,
    },
    {
      name: 'Tarraco (Tarragona)',
      lat: 41.1189,
      lng: 1.2445,
      portType: 'major_port',
      description: 'Capital of Hispania Tarraconensis with major harbour',
      startYear: -218,
      endYear: 476,
    },
    {
      name: 'Barcino (Barcelona)',
      lat: 41.3851,
      lng: 2.1734,
      portType: 'port',
      description: 'Roman colony and port founded by Hamilcar Barca',
      startYear: -218,
      endYear: 476,
    },
    {
      name: 'Emporiae (Empuries)',
      lat: 42.1339,
      lng: 3.1181,
      portType: 'port',
      description: 'Greek (Emporion) and Roman trading port in Catalonia',
      startYear: -575,
      endYear: 300,
    },
    {
      name: 'Malaca (Malaga)',
      lat: 36.7213,
      lng: -4.4214,
      portType: 'port',
      description: 'Phoenician port for salted fish and garum production',
      startYear: -770,
      endYear: 476,
    },
    {
      name: 'Hispalis (Seville)',
      lat: 37.3891,
      lng: -5.9845,
      portType: 'port',
      description: 'Major Guadalquivir river port and olive oil export centre',
      startYear: -206,
      endYear: 476,
    },
    {
      name: 'Olisipo (Lisbon)',
      lat: 38.7223,
      lng: -9.1393,
      portType: 'port',
      description: 'Atlantic port on the Tagus estuary',
      startYear: -200,
      endYear: 476,
    },
    {
      name: 'Brigantium (A Coruna)',
      lat: 43.3713,
      lng: -8.3959,
      portType: 'port',
      description: 'Northwestern port with the Tower of Hercules lighthouse',
      startYear: -100,
      endYear: 476,
    },
    {
      name: 'Tower of Hercules',
      lat: 43.3857,
      lng: -8.4065,
      portType: 'lighthouse',
      description: 'Oldest Roman lighthouse still in operation, built under Trajan',
      startYear: 98,
      endYear: 476,
    },
    {
      name: 'Portus Illicitanus (Santa Pola)',
      lat: 38.192,
      lng: -0.556,
      portType: 'port',
      description: 'Roman port serving the colony of Illici',
      startYear: -200,
      endYear: 476,
    },
    {
      name: 'Valentia (Valencia)',
      lat: 39.4699,
      lng: -0.3763,
      portType: 'port',
      description: 'Roman colony and port on the eastern coast of Hispania',
      startYear: -138,
      endYear: 476,
    },
    {
      name: 'Saguntum (Sagunto)',
      lat: 39.6815,
      lng: -0.2724,
      portType: 'harbour',
      description: 'Port whose siege by Hannibal triggered the Second Punic War',
      startYear: -500,
      endYear: 476,
    },
    {
      name: 'Baelo Claudia (Bolonia)',
      lat: 36.0917,
      lng: -5.775,
      portType: 'port',
      description: 'Major garum production center and embarkation point for Africa',
      startYear: -200,
      endYear: 400,
    },
    {
      name: 'Abdera (Adra)',
      lat: 36.75,
      lng: -3.0194,
      portType: 'harbour',
      description: 'Phoenician and Roman port in southern Spain',
      startYear: -700,
      endYear: 476,
    },

    // ── France (Gaul) ──────────────────────────────────────────────────
    {
      name: 'Massilia (Marseille)',
      lat: 43.2965,
      lng: 5.3698,
      portType: 'major_port',
      description: 'Oldest Greek colony in France, dominant pre-Roman western Mediterranean port',
      startYear: -600,
      endYear: 476,
    },
    {
      name: 'Narbo Martius (Narbonne)',
      lat: 43.1844,
      lng: 3.0033,
      portType: 'major_port',
      description: 'Capital of Gallia Narbonensis, major wine and grain export port',
      startYear: -118,
      endYear: 476,
    },
    {
      name: 'Forum Julii (Frejus)',
      lat: 43.4332,
      lng: 6.7356,
      portType: 'port',
      description: 'Major Roman naval base in southern Gaul, home of the fleet after Actium',
      startYear: -49,
      endYear: 476,
    },
    {
      name: 'Arelate (Arles)',
      lat: 43.6767,
      lng: 4.6278,
      portType: 'major_port',
      description: 'Key river port on the Rhone and trans-shipment hub',
      startYear: -46,
      endYear: 476,
    },
    {
      name: 'Antipolis (Antibes)',
      lat: 43.5804,
      lng: 7.1251,
      portType: 'harbour',
      description: "Greek and Roman port on the Cote d'Azur",
      startYear: -400,
      endYear: 476,
    },
    {
      name: 'Nicaea (Nice)',
      lat: 43.7102,
      lng: 7.262,
      portType: 'harbour',
      description: 'Greek colony and port on the Ligurian coast',
      startYear: -350,
      endYear: 476,
    },
    {
      name: 'Agde (Agatha)',
      lat: 43.311,
      lng: 3.4724,
      portType: 'port',
      description: 'Greek colony and port at the mouth of the Herault',
      startYear: -550,
      endYear: 476,
    },
    {
      name: 'Burdigala (Bordeaux)',
      lat: 44.8378,
      lng: -0.5792,
      portType: 'major_port',
      description: 'Major Atlantic river port and wine export center',
      startYear: -56,
      endYear: 476,
    },
    {
      name: 'Gesocribate (Brest)',
      lat: 48.3904,
      lng: -4.4861,
      portType: 'harbour',
      description: 'Roman port at the tip of Brittany',
      startYear: -50,
      endYear: 400,
    },
    {
      name: 'Portus Namnetum (Nantes)',
      lat: 47.2184,
      lng: -1.5536,
      portType: 'port',
      description: 'Roman Loire river port',
      startYear: -50,
      endYear: 476,
    },

    // ── Britain ─────────────────────────────────────────────────────────
    {
      name: 'Londinium (London)',
      lat: 51.5074,
      lng: -0.1278,
      portType: 'major_port',
      description: 'Roman Thames river port and capital of Britannia',
      startYear: 43,
      endYear: 410,
    },
    {
      name: 'Rutupiae (Richborough)',
      lat: 51.2978,
      lng: 1.3278,
      portType: 'port',
      description: 'Main Roman entry port for Britain, site of the Claudian invasion landing',
      startYear: 43,
      endYear: 410,
    },
    {
      name: 'Dubris (Dover)',
      lat: 51.1295,
      lng: 1.3089,
      portType: 'port',
      description: 'Roman cross-Channel port with lighthouse (pharos) remains',
      startYear: 43,
      endYear: 410,
    },
    {
      name: 'Dover Pharos',
      lat: 51.1292,
      lng: 1.3233,
      portType: 'lighthouse',
      description:
        'Roman lighthouse within Dover Castle, one of the tallest surviving Roman structures in Britain',
      startYear: 50,
      endYear: 410,
    },
    {
      name: 'Portus Adurni (Portchester)',
      lat: 50.8429,
      lng: -1.1198,
      portType: 'port',
      description: 'Saxon Shore fort with harbour, best preserved Roman fort in Northern Europe',
      startYear: 285,
      endYear: 410,
    },
    {
      name: 'Clausentum (Bitterne)',
      lat: 50.9133,
      lng: -1.3653,
      portType: 'harbour',
      description: 'Roman trading port on the Itchen river',
      startYear: 70,
      endYear: 410,
    },
    {
      name: 'Isca Dumnoniorum (Exeter)',
      lat: 50.7236,
      lng: -3.5275,
      portType: 'harbour',
      description: 'Southwestern Roman port on the River Exe',
      startYear: 55,
      endYear: 410,
    },
    {
      name: 'Camulodunum (Colchester)',
      lat: 51.8891,
      lng: 0.9038,
      portType: 'harbour',
      description: 'First Roman capital of Britain with river port',
      startYear: 43,
      endYear: 410,
    },
    {
      name: 'Regulbium (Reculver)',
      lat: 51.3792,
      lng: 1.1964,
      portType: 'harbour',
      description: 'Saxon Shore fort guarding the northern entrance to the Wantsum Channel',
      startYear: 200,
      endYear: 410,
    },
    {
      name: 'Lympne (Portus Lemanis)',
      lat: 51.0789,
      lng: 1.03,
      portType: 'harbour',
      description: 'Saxon Shore fort and harbour in Kent',
      startYear: 250,
      endYear: 410,
    },

    // ── Germania & Low Countries ───────────────────────────────────────
    {
      name: 'Colonia Agrippina (Cologne)',
      lat: 50.9375,
      lng: 6.9603,
      portType: 'port',
      description: 'Major Rhine river port and capital of Germania Inferior',
      startYear: -38,
      endYear: 476,
    },
    {
      name: 'Mogontiacum (Mainz)',
      lat: 49.9929,
      lng: 8.2473,
      portType: 'port',
      description: 'Major Rhine river port and legionary fortress',
      startYear: -13,
      endYear: 476,
    },
    {
      name: 'Castra Vetera (Xanten)',
      lat: 51.6594,
      lng: 6.4528,
      portType: 'harbour',
      description: 'Rhine river port near the legionary fortress',
      startYear: -13,
      endYear: 476,
    },
    {
      name: 'Forum Hadriani (Voorburg)',
      lat: 52.0667,
      lng: 4.35,
      portType: 'harbour',
      description: 'Roman river port in the Low Countries',
      startYear: 120,
      endYear: 270,
    },
    {
      name: 'Fectio (Vechten)',
      lat: 52.0408,
      lng: 5.16,
      portType: 'harbour',
      description: 'Roman Rhine frontier fort with river port',
      startYear: 4,
      endYear: 260,
    },

    // ── Danube ──────────────────────────────────────────────────────────
    {
      name: 'Carnuntum',
      lat: 48.1147,
      lng: 16.8558,
      portType: 'port',
      description: 'Major Danube river port and legionary base',
      startYear: -6,
      endYear: 400,
    },
    {
      name: 'Vindobona (Vienna)',
      lat: 48.2082,
      lng: 16.3738,
      portType: 'harbour',
      description: 'Danube river port and legionary fortress',
      startYear: 15,
      endYear: 476,
    },
    {
      name: 'Aquincum (Budapest)',
      lat: 47.5669,
      lng: 19.0489,
      portType: 'port',
      description: 'Major Danube port and capital of Pannonia Inferior',
      startYear: 89,
      endYear: 476,
    },
    {
      name: 'Sirmium (Sremska Mitrovica)',
      lat: 44.9722,
      lng: 19.6122,
      portType: 'port',
      description: 'Imperial capital and river port on the Sava',
      startYear: -100,
      endYear: 476,
    },

    // ── Black Sea ──────────────────────────────────────────────────────
    {
      name: 'Tomis (Constanta)',
      lat: 44.1598,
      lng: 28.6348,
      portType: 'major_port',
      description: "Major Black Sea port, Ovid's place of exile",
      startYear: -600,
      endYear: 476,
    },
    {
      name: 'Histria (Istria)',
      lat: 44.5489,
      lng: 28.7731,
      portType: 'port',
      description: 'Oldest Greek colony on the western Black Sea coast',
      startYear: -657,
      endYear: 476,
    },
    {
      name: 'Olbia',
      lat: 46.6953,
      lng: 31.9025,
      portType: 'port',
      description: 'Greek colony at the mouth of the Bug-Dnieper estuary',
      startYear: -647,
      endYear: 400,
    },
    {
      name: 'Chersonesus (Sevastopol)',
      lat: 44.6117,
      lng: 33.4913,
      portType: 'port',
      description: 'Greek and Roman port on the Crimean Peninsula',
      startYear: -422,
      endYear: 476,
    },
    {
      name: 'Panticapaeum (Kerch)',
      lat: 45.3514,
      lng: 36.4681,
      portType: 'major_port',
      description: 'Capital of the Bosporan Kingdom at the Kerch Strait',
      startYear: -600,
      endYear: 476,
    },
    {
      name: 'Dioscurias (Sukhumi)',
      lat: 43.0042,
      lng: 41.0153,
      portType: 'port',
      description: 'Greek colony and trading post on the eastern Black Sea',
      startYear: -550,
      endYear: 476,
    },
    {
      name: 'Phasis (Poti)',
      lat: 42.15,
      lng: 41.6667,
      portType: 'harbour',
      description: 'Colchian port at the eastern end of the Black Sea trade route',
      startYear: -600,
      endYear: 476,
    },
    {
      name: 'Odessos (Varna)',
      lat: 43.2141,
      lng: 27.9147,
      portType: 'port',
      description: 'Greek colony and major port on the Bulgarian Black Sea coast',
      startYear: -585,
      endYear: 476,
    },
    {
      name: 'Callatis (Mangalia)',
      lat: 43.82,
      lng: 28.5833,
      portType: 'harbour',
      description: 'Dorian colony on the Romanian Black Sea coast',
      startYear: -521,
      endYear: 476,
    },

    // ── Dalmatia & Illyricum ───────────────────────────────────────────
    {
      name: 'Salona (Solin)',
      lat: 43.5381,
      lng: 16.4842,
      portType: 'major_port',
      description: 'Capital of Roman Dalmatia and major Adriatic port',
      startYear: -119,
      endYear: 614,
    },
    {
      name: 'Spalatum (Split)',
      lat: 43.5081,
      lng: 16.4402,
      portType: 'port',
      description: "Diocletian's Palace complex with harbour",
      startYear: 293,
      endYear: 476,
    },
    {
      name: 'Iader (Zadar)',
      lat: 44.1194,
      lng: 15.2314,
      portType: 'port',
      description: 'Roman colony and port in Dalmatia',
      startYear: -59,
      endYear: 476,
    },
    {
      name: 'Narona (Vid)',
      lat: 43.05,
      lng: 17.6333,
      portType: 'harbour',
      description: 'Roman port on the Neretva river',
      startYear: -200,
      endYear: 476,
    },
    {
      name: 'Epidaurum (Cavtat)',
      lat: 42.585,
      lng: 18.2186,
      portType: 'harbour',
      description: 'Roman port in southern Dalmatia',
      startYear: -228,
      endYear: 614,
    },
    {
      name: 'Pola (Pula)',
      lat: 44.8666,
      lng: 13.8496,
      portType: 'port',
      description: 'Major Roman port in Istria with amphitheatre',
      startYear: -177,
      endYear: 476,
    },
    {
      name: 'Parentium (Porec)',
      lat: 45.2272,
      lng: 13.5947,
      portType: 'harbour',
      description: 'Roman colony and port in Istria',
      startYear: -200,
      endYear: 476,
    },

    // ── Crete & Cyprus ─────────────────────────────────────────────────
    {
      name: 'Salamis (Cyprus)',
      lat: 35.1842,
      lng: 33.9056,
      portType: 'major_port',
      description: 'Largest city and port of ancient Cyprus',
      startYear: -1100,
      endYear: 648,
    },
    {
      name: 'Paphos',
      lat: 34.7553,
      lng: 32.4083,
      portType: 'port',
      description: 'Roman capital of Cyprus with harbour',
      startYear: -300,
      endYear: 476,
    },
    {
      name: 'Kourion',
      lat: 34.6649,
      lng: 32.8811,
      portType: 'harbour',
      description: 'Greco-Roman port on the southern coast of Cyprus',
      startYear: -700,
      endYear: 476,
    },
    {
      name: 'Amathous',
      lat: 34.7111,
      lng: 33.1444,
      portType: 'harbour',
      description: 'Ancient port city on the south coast of Cyprus',
      startYear: -1000,
      endYear: 476,
    },
    {
      name: 'Kition (Larnaca)',
      lat: 34.924,
      lng: 33.6273,
      portType: 'port',
      description: 'Phoenician and Roman port on the southeast coast of Cyprus',
      startYear: -1200,
      endYear: 476,
    },

    // ── Malta ──────────────────────────────────────────────────────────
    {
      name: 'Melita (Malta)',
      lat: 35.8979,
      lng: 14.5145,
      portType: 'port',
      description: 'Strategic island port where Saint Paul was shipwrecked',
      startYear: -700,
      endYear: 476,
    },

    // ── Balearic Islands ───────────────────────────────────────────────
    {
      name: 'Palma (Mallorca)',
      lat: 39.5696,
      lng: 2.6502,
      portType: 'port',
      description: 'Roman colony and port in the Balearic Islands',
      startYear: -123,
      endYear: 476,
    },
    {
      name: 'Portus Magonis (Mahon)',
      lat: 39.8886,
      lng: 4.2658,
      portType: 'harbour',
      description: 'One of the finest natural harbours in the Mediterranean',
      startYear: -200,
      endYear: 476,
    },
    {
      name: 'Ebusus (Ibiza)',
      lat: 38.9067,
      lng: 1.4206,
      portType: 'port',
      description: 'Phoenician and Roman port in the Balearics',
      startYear: -654,
      endYear: 476,
    },

    // ── Additional infrastructure ──────────────────────────────────────
    {
      name: 'Portus Cosanus (Orbetello)',
      lat: 42.4428,
      lng: 11.2128,
      portType: 'harbour',
      description: 'Roman harbour with well-preserved breakwater (pilae)',
      startYear: -273,
      endYear: 300,
    },
    {
      name: 'Classis (Ravenna fleet base)',
      lat: 44.3833,
      lng: 12.2667,
      portType: 'shipyard',
      description: 'Base and shipyard of the Classis Ravennatis',
      startYear: -27,
      endYear: 476,
    },
    {
      name: 'Navalia (Rome)',
      lat: 41.8916,
      lng: 12.4775,
      portType: 'shipyard',
      description: 'Roman naval dockyard on the Tiber in Rome',
      startYear: -338,
      endYear: 300,
    },
    {
      name: 'Forum Appii',
      lat: 41.4722,
      lng: 13.0083,
      portType: 'harbour',
      description: 'Canal port along the Appian Way through the Pontine Marshes',
      startYear: -312,
      endYear: 476,
    },
    {
      name: 'Portus Julius (Baiae)',
      lat: 40.8214,
      lng: 14.0753,
      portType: 'shipyard',
      description: "Agrippa's naval base connecting Lake Lucrinus and Lake Avernus",
      startYear: -37,
      endYear: 200,
    },
    {
      name: 'Leptis Magna Lighthouse',
      lat: 32.64,
      lng: 14.2967,
      portType: 'lighthouse',
      description: 'Lighthouse at the entrance to the Severan harbour at Leptis Magna',
      startYear: 200,
      endYear: 500,
    },
    {
      name: 'Caesarea Lighthouse',
      lat: 32.5031,
      lng: 34.8856,
      portType: 'lighthouse',
      description: "Lighthouse at the entrance to Herod's harbour at Caesarea Maritima",
      startYear: -10,
      endYear: 640,
    },
    {
      name: 'Patara Lighthouse',
      lat: 36.2608,
      lng: 29.3147,
      portType: 'lighthouse',
      description: 'One of the best-preserved ancient lighthouses in the eastern Mediterranean',
      startYear: 60,
      endYear: 476,
    },
    {
      name: 'Messina Lighthouse',
      lat: 38.265,
      lng: 15.6178,
      portType: 'lighthouse',
      description: 'Ancient lighthouse guiding ships through the Strait of Messina',
      startYear: -200,
      endYear: 476,
    },
    {
      name: 'Corunna Lighthouse (Tower of Hercules)',
      lat: 43.3857,
      lng: -8.4065,
      portType: 'lighthouse',
      description: 'Roman lighthouse rebuilt by Trajan, still in use today',
      startYear: 98,
      endYear: 476,
    },
    {
      name: "Boulogne Lighthouse (Tour d'Ordre)",
      lat: 50.7272,
      lng: 1.607,
      portType: 'lighthouse',
      description: "Caligula's lighthouse at Gesoriacum for the Channel crossing",
      startYear: 39,
      endYear: 410,
    },

    // ── Additional major ports ─────────────────────────────────────────
    {
      name: 'Arados (Arwad)',
      lat: 34.8583,
      lng: 35.8583,
      portType: 'port',
      description: 'Phoenician island port off the Syrian coast',
      startYear: -2000,
      endYear: 476,
    },
    {
      name: 'Dor',
      lat: 32.6142,
      lng: 34.9139,
      portType: 'harbour',
      description: 'Ancient Canaanite and Phoenician harbour south of Haifa',
      startYear: -1200,
      endYear: 300,
    },
    {
      name: 'Gaza',
      lat: 31.5018,
      lng: 34.4668,
      portType: 'port',
      description: 'Major port and trade hub at the southern end of the Levantine coast',
      startYear: -1500,
      endYear: 476,
    },
    {
      name: 'Ascalon (Ashkelon)',
      lat: 31.6656,
      lng: 34.5468,
      portType: 'port',
      description: 'Ancient port and one of the five Philistine city-states',
      startYear: -1200,
      endYear: 476,
    },
    {
      name: 'Corcyra (Corfu)',
      lat: 39.6243,
      lng: 19.9217,
      portType: 'port',
      description: 'Strategic island port on the route between Italy and Greece',
      startYear: -734,
      endYear: 476,
    },
    {
      name: 'Ithaca',
      lat: 38.3667,
      lng: 20.7167,
      portType: 'harbour',
      description: 'Legendary homeland of Odysseus with several small harbours',
      startYear: -800,
      endYear: 476,
    },
    {
      name: 'Methone',
      lat: 36.8194,
      lng: 21.7044,
      portType: 'harbour',
      description: 'Strategic port in the southwestern Peloponnese',
      startYear: -700,
      endYear: 476,
    },
    {
      name: 'Gythium',
      lat: 36.7625,
      lng: 22.5642,
      portType: 'port',
      description: 'Port of Sparta and base of the Lacedaemonian fleet',
      startYear: -600,
      endYear: 476,
    },
    {
      name: 'Naupactus (Lepanto)',
      lat: 38.3917,
      lng: 21.8278,
      portType: 'harbour',
      description: 'Strategic harbour controlling the entrance to the Gulf of Corinth',
      startYear: -600,
      endYear: 476,
    },
    {
      name: 'Thasos',
      lat: 40.7767,
      lng: 24.7117,
      portType: 'port',
      description: 'Island port with gold mines and marble quarries',
      startYear: -680,
      endYear: 476,
    },
    {
      name: 'Samothrace',
      lat: 40.4714,
      lng: 25.5244,
      portType: 'harbour',
      description: 'Sacred island harbour, site of the Sanctuary of the Great Gods',
      startYear: -700,
      endYear: 476,
    },
    {
      name: 'Lesbos (Mytilene)',
      lat: 39.1042,
      lng: 26.5536,
      portType: 'port',
      description: 'Major port of the northeastern Aegean',
      startYear: -600,
      endYear: 476,
    },
    {
      name: 'Chios',
      lat: 38.3717,
      lng: 26.1367,
      portType: 'port',
      description: 'Famous for wine production and maritime trade',
      startYear: -700,
      endYear: 476,
    },
    {
      name: 'Samos',
      lat: 37.7572,
      lng: 26.9769,
      portType: 'port',
      description: "Major island port, base of Polycrates' fleet",
      startYear: -700,
      endYear: 476,
    },
    {
      name: 'Cos (Kos)',
      lat: 36.8939,
      lng: 26.9442,
      portType: 'port',
      description: 'Island port near the Asclepion healing sanctuary',
      startYear: -600,
      endYear: 476,
    },
    {
      name: 'Cnossus Harbour (Amnissos)',
      lat: 35.3336,
      lng: 25.1739,
      portType: 'harbour',
      description: 'Harbour serving Knossos on the north coast of Crete',
      startYear: -1500,
      endYear: 476,
    },

    // ── Additional Red Sea & Indian Ocean ──────────────────────────────
    {
      name: 'Clysma (Suez)',
      lat: 29.9668,
      lng: 32.5498,
      portType: 'port',
      description: "Roman port at the head of the Red Sea, connected to the Nile by Trajan's canal",
      startYear: -300,
      endYear: 640,
    },
    {
      name: 'Adulis',
      lat: 15.4,
      lng: 39.65,
      portType: 'port',
      description: 'Aksumite port on the Red Sea, key for trade with India and Arabia',
      startYear: -300,
      endYear: 640,
    },
    {
      name: 'Leuke Kome',
      lat: 25.95,
      lng: 36.5833,
      portType: 'port',
      description: 'Arabian port on the Red Sea for the incense trade',
      startYear: -300,
      endYear: 300,
    },
    {
      name: 'Aila (Aqaba)',
      lat: 29.5267,
      lng: 35.0078,
      portType: 'port',
      description: 'Roman port at the head of the Gulf of Aqaba',
      startYear: -100,
      endYear: 640,
    },

    // ── Additional Western Mediterranean ───────────────────────────────
    {
      name: 'Rusadir (Melilla)',
      lat: 35.2928,
      lng: -2.9381,
      portType: 'harbour',
      description: 'Phoenician and Roman port on the North African coast',
      startYear: -600,
      endYear: 476,
    },
    {
      name: 'Portus Magnus (Arzew)',
      lat: 35.8556,
      lng: -0.3178,
      portType: 'port',
      description: 'Roman port in Mauretania Caesariensis',
      startYear: -200,
      endYear: 476,
    },
    {
      name: 'Thabraca (Tabarka)',
      lat: 36.9544,
      lng: 8.7581,
      portType: 'harbour',
      description: 'Roman port in northeastern Tunisia near the coral coast',
      startYear: -300,
      endYear: 476,
    },
    {
      name: 'Clupea (Kelibia)',
      lat: 36.85,
      lng: 11.0994,
      portType: 'harbour',
      description: 'Roman port at the tip of Cap Bon peninsula',
      startYear: -300,
      endYear: 476,
    },
    {
      name: 'Thapsus (Ras Dimass)',
      lat: 35.6019,
      lng: 11.0442,
      portType: 'harbour',
      description: "Site of Caesar's decisive African victory in 46 BC",
      startYear: -600,
      endYear: 476,
    },
    {
      name: 'Acholla',
      lat: 34.9333,
      lng: 10.8667,
      portType: 'harbour',
      description: 'Roman port in Byzacena with fine mosaic pavements',
      startYear: -300,
      endYear: 476,
    },

    // ── Additional Atlantic & Northern ──────────────────────────────────
    {
      name: 'Gesoriacum (Boulogne)',
      lat: 50.7264,
      lng: 1.6147,
      portType: 'major_port',
      description: 'Main Roman cross-Channel port, base of the Classis Britannica',
      startYear: -55,
      endYear: 410,
    },
    {
      name: 'Augusta Treverorum (Trier)',
      lat: 49.749,
      lng: 6.6371,
      portType: 'port',
      description: 'Imperial capital and Moselle river port',
      startYear: -16,
      endYear: 476,
    },
    {
      name: 'Lutetia (Paris)',
      lat: 48.8566,
      lng: 2.3522,
      portType: 'harbour',
      description: 'Roman Seine river port on the Ile de la Cite',
      startYear: -52,
      endYear: 476,
    },
    {
      name: 'Rotomagus (Rouen)',
      lat: 49.4432,
      lng: 1.0999,
      portType: 'port',
      description: 'Roman Seine river port in northern Gaul',
      startYear: -50,
      endYear: 476,
    },
    {
      name: 'Tolosa (Toulouse)',
      lat: 43.6047,
      lng: 1.4442,
      portType: 'harbour',
      description: 'Garonne river port connecting Atlantic and Mediterranean trade',
      startYear: -200,
      endYear: 476,
    },
    {
      name: 'Lugdunum (Lyon)',
      lat: 45.764,
      lng: 4.8357,
      portType: 'port',
      description: 'Capital of Gaul at the confluence of the Rhone and Saone',
      startYear: -43,
      endYear: 476,
    },
    {
      name: 'Vienna (Vienne)',
      lat: 45.5254,
      lng: 4.8784,
      portType: 'harbour',
      description: 'Important Rhone river port in southern Gaul',
      startYear: -100,
      endYear: 476,
    },
  ]

  return ports.map((p) => ({
    ...p,
    id: p.id || `port-${slugify(p.name)}`,
    source: 'ancientportsantiques.com (curated)',
  }))
}

// ────────────────────────────────────────────────────────────────────────────
// Deduplication
// ────────────────────────────────────────────────────────────────────────────

function isDuplicate(port: AncientPort, existing: AncientPort[], threshold: number): boolean {
  return existing.some(
    (e) =>
      Math.abs(e.lat - port.lat) < threshold &&
      Math.abs(e.lng - port.lng) < threshold &&
      e.name.toLowerCase().split(/[\s(]/)[0] === port.name.toLowerCase().split(/[\s(]/)[0],
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Ancient Ports & Harbours Ingestion ===\n')

  let ports: AncientPort[] = []

  // Approach 1: Try fetching the Excel database
  console.log('Approach 1: Fetching Excel database from ancientportsantiques.com...')
  const excelData = await fetchExcelData()

  if (excelData && excelData.length > 10) {
    console.log(`\n  Downloaded ${excelData.length} rows from Excel file`)
    const parsed = parseRows(excelData)
    if (parsed.length > 50) {
      ports = parsed
      console.log(`  Successfully parsed ${ports.length} ports from Excel data`)
    } else {
      console.log(
        `  Only ${parsed.length} ports parsed from Excel — supplementing with curated data`,
      )
      const curated = getCuratedPorts()
      ports = [...parsed]
      let added = 0
      for (const cp of curated) {
        if (!isDuplicate(cp, ports, DEDUP_THRESHOLD)) {
          ports.push(cp)
          added++
        }
      }
      console.log(`  Added ${added} curated ports (total: ${ports.length})`)
    }
  } else {
    console.log('  Excel download failed or returned insufficient data.')
    console.log('\nFalling back to curated dataset...')
    ports = getCuratedPorts()
    console.log(`  Loaded ${ports.length} curated ancient ports`)
  }

  // Remove exact duplicates (same name + very close coords)
  const deduped: AncientPort[] = []
  for (const p of ports) {
    if (!isDuplicate(p, deduped, DEDUP_THRESHOLD * 0.5)) {
      deduped.push(p)
    }
  }
  console.log(`\n  After deduplication: ${deduped.length} ports`)

  // Sort by name
  deduped.sort((a, b) => a.name.localeCompare(b.name))

  // Write output
  const json = JSON.stringify(deduped, null, 2)
  await writeFile(OUTPUT_PATH, json + '\n')
  console.log(`\n  Written to ${OUTPUT_PATH}`)
  console.log(`  File size: ${(json.length / 1024).toFixed(1)} KB`)

  // Stats
  const byType = new Map<string, number>()
  for (const p of deduped) {
    byType.set(p.portType, (byType.get(p.portType) || 0) + 1)
  }
  console.log('\n  By port type:')
  for (const [type, count] of [...byType.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${type}: ${count}`)
  }

  const bySrc = new Map<string, number>()
  for (const p of deduped) {
    bySrc.set(p.source, (bySrc.get(p.source) || 0) + 1)
  }
  console.log('\n  By source:')
  for (const [src, count] of bySrc) {
    console.log(`    ${src}: ${count}`)
  }

  // Lat/lng bounds
  const lats = deduped.map((p) => p.lat)
  const lngs = deduped.map((p) => p.lng)
  console.log(
    `\n  Bounds: lat [${Math.min(...lats).toFixed(2)}, ${Math.max(...lats).toFixed(2)}], lng [${Math.min(...lngs).toFixed(2)}, ${Math.max(...lngs).toFixed(2)}]`,
  )

  console.log('\n=== Ingestion complete ===')
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
