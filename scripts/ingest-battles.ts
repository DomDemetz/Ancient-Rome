/**
 * Script to ingest Roman battle data from the Roman-Battles-Droid CSV
 * and supplement with hand-curated major battles.
 *
 * Usage: npx tsx scripts/ingest-battles.ts
 */

import { writeFile, mkdir } from 'fs/promises'
import { fileURLToPath } from 'url'

const CSV_URL =
  'https://raw.githubusercontent.com/rharriso/Roman-Battles-Droid/master/assets/RomanBattles.csv'

interface Battle {
  id: string
  name: string
  year: number
  lat: number
  lng: number
  outcome: 'victory' | 'defeat' | 'draw' | 'unknown'
  combatants: string
  commander: string
  description: string
  source: string
}

function toKebabCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .replace(/-+/g, '-')
}

function parseYear(yearStr: string): number | null {
  if (!yearStr) return null
  const cleaned = yearStr.trim()

  // Handle "509 BC" style
  const bcMatch = cleaned.match(/^(\d+)\s*BC$/i)
  if (bcMatch) return -parseInt(bcMatch[1], 10)

  // Handle plain positive numbers (AD years)
  const adMatch = cleaned.match(/^(\d{1,3})$/)
  if (adMatch) return parseInt(adMatch[1], 10)

  // Handle "16" or "101" etc
  const plainNum = parseInt(cleaned, 10)
  if (!isNaN(plainNum) && plainNum > 0 && plainNum < 600) return plainNum

  return null
}

function parseCoordinates(coordStr: string): { lat: number; lng: number } | null {
  if (!coordStr || !coordStr.trim()) return null
  const cleaned = coordStr.replace(/\t/g, '').trim()
  const parts = cleaned.split(';').map((s) => s.trim())
  if (parts.length < 2) return null
  const lat = parseFloat(parts[0])
  const lng = parseFloat(parts[1])
  if (isNaN(lat) || isNaN(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat: Math.round(lat * 10000) / 10000, lng: Math.round(lng * 10000) / 10000 }
}

function classifyOutcome(
  result: string,
  romanAllies: string,
  enemyAllies: string,
): Battle['outcome'] {
  if (!result) return 'unknown'
  const r = result.toLowerCase()

  // Check if Rome is on the "enemy" side (swapped in some civil war entries)
  const romeIsEnemy =
    enemyAllies.toLowerCase().includes('roman republic') ||
    enemyAllies.toLowerCase().includes('roman empire')
  const romeIsAlly =
    romanAllies.toLowerCase().includes('roman') || romanAllies.toLowerCase().includes('rome')

  // Determine which side "victory" favors
  const isVictory =
    r.includes('roman victory') ||
    r.includes('decisive roman') ||
    r.includes('roman decisive') ||
    r.includes('roman pyrrhic')
  const isDefeat = r.includes('defeat') && !r.includes('defeat of monarchist')

  if (isVictory) return 'victory'
  if (isDefeat) return 'defeat'

  // For civil wars and other results, check more broadly
  if (r.includes('victory') || r.includes('victorious')) {
    if (romeIsEnemy && !romeIsAlly) return 'defeat'
    // Civil wars where both sides are Roman
    if (
      r.includes('caesar') ||
      r.includes('octavian') ||
      r.includes('constantine') ||
      r.includes('theodosius') ||
      r.includes('severus') ||
      r.includes('licinius')
    ) {
      return 'victory' // Roman vs Roman - mark as victory (winner's perspective)
    }
    // Check if it says someone specific won
    if (
      r.includes('gallic victory') ||
      r.includes('cimbri') ||
      r.includes('gothic') ||
      r.includes('carthaginian') ||
      r.includes('samnite') ||
      r.includes('parthian') ||
      r.includes('sassanid') ||
      r.includes('germanic') ||
      r.includes('vandalic') ||
      r.includes('visigoth') ||
      r.includes('ostrogothic') ||
      r.includes('alamanni victory')
    ) {
      return 'defeat'
    }
    return 'victory'
  }

  if (
    r.includes('stalemate') ||
    r.includes('indecisive') ||
    r.includes('inconclusive') ||
    r.includes('draw')
  ) {
    return 'draw'
  }

  // Pyrrhic victory for enemy
  if (r.includes('pyrrhic') && (r.includes('greek') || r.includes('carthag'))) return 'defeat'

  return 'unknown'
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

async function fetchCSV(): Promise<string | null> {
  try {
    console.log(`Fetching CSV from ${CSV_URL}...`)
    const res = await fetch(CSV_URL)
    if (!res.ok) {
      console.log(`  Failed to fetch CSV: ${res.status}`)
      return null
    }
    const text = await res.text()
    console.log(`  Fetched ${text.length} bytes`)
    return text
  } catch (err) {
    console.log(`  Error fetching CSV: ${err}`)
    return null
  }
}

function parseCsvBattles(csv: string): Battle[] {
  const lines = csv.split('\n').filter((l) => l.trim())
  if (lines.length < 2) return []

  // Skip header
  const battles: Battle[] = []

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i])
    if (fields.length < 6) continue

    const [
      ,
      yearStr,
      battleName,
      location,
      result,
      coordinates,
      romanCommanders,
      ,
      romanAllies,
      enemyAllies,
    ] = fields

    if (!battleName || !battleName.trim()) continue

    const year = parseYear(yearStr)
    if (year === null) continue

    // Filter: only include battles roughly in the Roman period (753 BC to 476 AD)
    if (year < -753 || year > 476) continue

    const coords = parseCoordinates(coordinates)
    if (!coords) continue

    // Dyrrhachium has wrong coordinates in CSV (1.31, 19.45) - skip, we have curated version
    if (battleName.includes('Dyrrhachium') && coords.lat < 10) continue

    const name = battleName.replace(/\s+/g, ' ').trim()
    const id = toKebabCase(name)

    const romanCmd = (romanCommanders || '').replace(/;/g, ', ').replace(/\s+/g, ' ').trim()

    const rAllies = (romanAllies || '').trim()
    const eAllies = (enemyAllies || '').trim()

    const combatantParts: string[] = []
    if (rAllies) combatantParts.push(rAllies)
    if (eAllies) combatantParts.push(eAllies)
    const combatants =
      combatantParts.length === 2
        ? `${combatantParts[0]} vs ${combatantParts[1]}`
        : combatantParts.join(' vs ') || 'Unknown'

    const outcome = classifyOutcome(result, rAllies, eAllies)

    const locationClean = (location || '').replace(/;/g, ',').replace(/\s+/g, ' ').trim()
    const description = locationClean
      ? `${name} (${Math.abs(year)} ${year < 0 ? 'BC' : 'AD'}) near ${locationClean}`
      : `${name} (${Math.abs(year)} ${year < 0 ? 'BC' : 'AD'})`

    battles.push({
      id,
      name,
      year,
      lat: coords.lat,
      lng: coords.lng,
      outcome,
      combatants,
      commander: romanCmd || 'Unknown',
      description,
      source: 'Roman-Battles-Droid',
    })
  }

  return battles
}

/**
 * Hand-curated list of important Roman battles with verified coordinates.
 * Supplements the CSV data to ensure comprehensive coverage.
 */
function getCuratedBattles(): Battle[] {
  const curated: Array<Omit<Battle, 'id' | 'source'>> = [
    // Regal Period and Early Republic
    {
      name: 'Battle of Heraclea',
      year: -280,
      lat: 40.2061,
      lng: 16.6314,
      outcome: 'defeat',
      combatants: 'Roman Republic vs Epirus',
      commander: 'Publius Valerius Laevinus',
      description:
        'Battle of Heraclea (280 BC). Pyrrhus defeats Rome in a costly "Pyrrhic victory" in southern Italy.',
    },
    {
      name: 'Battle of Asculum',
      year: -279,
      lat: 41.2156,
      lng: 15.5578,
      outcome: 'defeat',
      combatants: 'Roman Republic vs Epirus',
      commander: 'Publius Decius Mus',
      description: 'Battle of Asculum (279 BC). Another Pyrrhic victory for Pyrrhus against Rome.',
    },
    {
      name: 'Battle of Beneventum',
      year: -275,
      lat: 41.1333,
      lng: 14.7833,
      outcome: 'victory',
      combatants: 'Roman Republic vs Epirus',
      commander: 'Manius Curius Dentatus',
      description:
        'Battle of Beneventum (275 BC). Romans defeat Pyrrhus, ending his Italian campaign.',
    },
    // First Punic War
    {
      name: 'Battle of Mylae',
      year: -260,
      lat: 38.2167,
      lng: 15.2333,
      outcome: 'victory',
      combatants: 'Roman Republic vs Carthage',
      commander: 'Gaius Duilius',
      description:
        'Battle of Mylae (260 BC). First major Roman naval victory using the corvus boarding device.',
    },
    {
      name: 'Battle of Cape Ecnomus',
      year: -256,
      lat: 37.1083,
      lng: 13.9469,
      outcome: 'victory',
      combatants: 'Roman Republic vs Carthage',
      commander: 'Marcus Atilius Regulus',
      description:
        'Battle of Cape Ecnomus (256 BC). One of the largest naval battles in antiquity.',
    },
    {
      name: 'Battle of Drepana',
      year: -249,
      lat: 38.0167,
      lng: 12.5167,
      outcome: 'defeat',
      combatants: 'Roman Republic vs Carthage',
      commander: 'Publius Claudius Pulcher',
      description: 'Battle of Drepana (249 BC). Major Roman naval defeat in the First Punic War.',
    },
    {
      name: 'Battle of the Aegates Islands',
      year: -241,
      lat: 37.9667,
      lng: 12.2,
      outcome: 'victory',
      combatants: 'Roman Republic vs Carthage',
      commander: 'Gaius Lutatius Catulus',
      description:
        'Battle of the Aegates Islands (241 BC). Decisive Roman victory ending the First Punic War.',
    },
    // Second Punic War
    {
      name: 'Battle of the Trebia',
      year: -218,
      lat: 45.05,
      lng: 9.6,
      outcome: 'defeat',
      combatants: 'Roman Republic vs Carthage',
      commander: 'Tiberius Sempronius Longus',
      description:
        'Battle of the Trebia (218 BC). Hannibal defeats Rome in his first major Italian victory.',
    },
    {
      name: 'Battle of Lake Trasimene',
      year: -217,
      lat: 43.1394,
      lng: 12.1075,
      outcome: 'defeat',
      combatants: 'Roman Republic vs Carthage',
      commander: 'Gaius Flaminius',
      description:
        'Battle of Lake Trasimene (217 BC). Hannibal ambushes and destroys a Roman army.',
    },
    {
      name: 'Battle of Cannae',
      year: -216,
      lat: 41.305,
      lng: 16.1325,
      outcome: 'defeat',
      combatants: 'Roman Republic vs Carthage',
      commander: 'Gaius Terentius Varro',
      description:
        "Battle of Cannae (216 BC). Hannibal's masterpiece double-envelopment, worst Roman defeat ever.",
    },
    {
      name: 'Battle of the Metaurus',
      year: -207,
      lat: 43.8333,
      lng: 13.05,
      outcome: 'victory',
      combatants: 'Roman Republic vs Carthage',
      commander: 'Marcus Livius Salinator',
      description:
        'Battle of the Metaurus (207 BC). Romans kill Hasdrubal, ending Carthaginian reinforcement hopes.',
    },
    {
      name: 'Battle of Ilipa',
      year: -206,
      lat: 37.3772,
      lng: -5.9869,
      outcome: 'victory',
      combatants: 'Roman Republic vs Carthage',
      commander: 'Scipio Africanus',
      description:
        "Battle of Ilipa (206 BC). Scipio's brilliant maneuver breaks Carthaginian power in Iberia.",
    },
    {
      name: 'Battle of Zama',
      year: -202,
      lat: 36.115,
      lng: 9.2844,
      outcome: 'victory',
      combatants: 'Roman Republic vs Carthage',
      commander: 'Scipio Africanus',
      description: 'Battle of Zama (202 BC). Scipio defeats Hannibal, ending the Second Punic War.',
    },
    // Macedonian Wars and Eastern Expansion
    {
      name: 'Battle of Cynoscephalae',
      year: -197,
      lat: 39.6417,
      lng: 22.4167,
      outcome: 'victory',
      combatants: 'Roman Republic vs Macedon',
      commander: 'Titus Quinctius Flamininus',
      description:
        'Battle of Cynoscephalae (197 BC). Roman legions prove superior to the Macedonian phalanx.',
    },
    {
      name: 'Battle of Thermopylae',
      year: -191,
      lat: 38.8053,
      lng: 22.5628,
      outcome: 'victory',
      combatants: 'Roman Republic vs Seleucid Empire',
      commander: 'Manius Acilius Glabrio',
      description:
        'Battle of Thermopylae (191 BC). Romans defeat Antiochus III at the legendary pass.',
    },
    {
      name: 'Battle of Magnesia',
      year: -190,
      lat: 38.6131,
      lng: 27.4258,
      outcome: 'victory',
      combatants: 'Roman Republic vs Seleucid Empire',
      commander: 'Lucius Cornelius Scipio',
      description:
        'Battle of Magnesia (190 BC). Decisive defeat of Antiochus III, Rome dominates Asia Minor.',
    },
    {
      name: 'Battle of Pydna',
      year: -168,
      lat: 40.3653,
      lng: 22.6131,
      outcome: 'victory',
      combatants: 'Roman Republic vs Macedon',
      commander: 'Lucius Aemilius Paullus',
      description: 'Battle of Pydna (168 BC). Destruction of the Macedonian kingdom.',
    },
    // Third Punic War and Greece
    {
      name: 'Battle of Carthage',
      year: -146,
      lat: 36.8531,
      lng: 10.3231,
      outcome: 'victory',
      combatants: 'Roman Republic vs Carthage',
      commander: 'Scipio Aemilianus',
      description: 'Battle of Carthage (146 BC). Destruction of Carthage, ending the Punic Wars.',
    },
    {
      name: 'Battle of Corinth',
      year: -146,
      lat: 37.9333,
      lng: 22.9333,
      outcome: 'victory',
      combatants: 'Roman Republic vs Achaean League',
      commander: 'Lucius Mummius',
      description: 'Battle of Corinth (146 BC). Sack of Corinth, Rome dominates Greece.',
    },
    // Jugurthine and Cimbri Wars
    {
      name: 'Battle of Arausio',
      year: -105,
      lat: 44.1383,
      lng: 4.8097,
      outcome: 'defeat',
      combatants: 'Roman Republic vs Cimbri and Teutones',
      commander: 'Quintus Servilius Caepio',
      description: 'Battle of Arausio (105 BC). Catastrophic Roman defeat, worst since Cannae.',
    },
    {
      name: 'Battle of Aquae Sextiae',
      year: -102,
      lat: 43.5311,
      lng: 5.454,
      outcome: 'victory',
      combatants: 'Roman Republic vs Teutones',
      commander: 'Gaius Marius',
      description:
        'Battle of Aquae Sextiae (102 BC). Marius annihilates the Teutones near modern Aix-en-Provence.',
    },
    {
      name: 'Battle of Vercellae',
      year: -101,
      lat: 45.3167,
      lng: 8.4167,
      outcome: 'victory',
      combatants: 'Roman Republic vs Cimbri',
      commander: 'Gaius Marius',
      description:
        'Battle of Vercellae (101 BC). Marius destroys the Cimbri, ending the Germanic threat.',
    },
    // Mithridatic Wars
    {
      name: 'Battle of Chaeronea',
      year: -86,
      lat: 38.5167,
      lng: 22.85,
      outcome: 'victory',
      combatants: 'Roman Republic vs Pontus',
      commander: 'Lucius Cornelius Sulla',
      description: 'Battle of Chaeronea (86 BC). Sulla crushes Pontic forces in Greece.',
    },
    {
      name: 'Battle of Orchomenus',
      year: -85,
      lat: 38.4833,
      lng: 22.9833,
      outcome: 'victory',
      combatants: 'Roman Republic vs Pontus',
      commander: 'Lucius Cornelius Sulla',
      description:
        "Battle of Orchomenus (85 BC). Sulla completes the defeat of Mithridates' forces in Greece.",
    },
    {
      name: 'Battle of Tigranocerta',
      year: -69,
      lat: 38.1422,
      lng: 41.0014,
      outcome: 'victory',
      combatants: 'Roman Republic vs Armenia',
      commander: 'Lucius Licinius Lucullus',
      description:
        'Battle of Tigranocerta (69 BC). Lucullus defeats the vast Armenian army of Tigranes.',
    },
    // Spartacus
    {
      name: 'Battle of the Silarus River',
      year: -71,
      lat: 40.6333,
      lng: 15.1667,
      outcome: 'victory',
      combatants: 'Roman Republic vs Slave Revolt',
      commander: 'Marcus Licinius Crassus',
      description:
        'Battle of the Silarus River (71 BC). Crassus defeats Spartacus, ending the slave revolt.',
    },
    // Carrhae
    {
      name: 'Battle of Carrhae',
      year: -53,
      lat: 36.8667,
      lng: 39.0333,
      outcome: 'defeat',
      combatants: 'Roman Republic vs Parthian Empire',
      commander: 'Marcus Licinius Crassus',
      description:
        'Battle of Carrhae (53 BC). Disastrous Roman defeat, Crassus killed, legionary eagles captured.',
    },
    // Gallic Wars
    {
      name: 'Battle of Bibracte',
      year: -58,
      lat: 46.9267,
      lng: 4.0386,
      outcome: 'victory',
      combatants: 'Roman Republic vs Helvetii',
      commander: 'Julius Caesar',
      description:
        'Battle of Bibracte (58 BC). Caesar defeats the migrating Helvetii in his first Gallic campaign.',
    },
    {
      name: 'Battle of the Sabis',
      year: -57,
      lat: 50.3,
      lng: 3.9,
      outcome: 'victory',
      combatants: 'Roman Republic vs Nervii',
      commander: 'Julius Caesar',
      description: 'Battle of the Sabis (57 BC). Caesar barely survives an ambush by the Nervii.',
    },
    {
      name: 'Battle of Alesia',
      year: -52,
      lat: 47.537,
      lng: 4.5,
      outcome: 'victory',
      combatants: 'Roman Republic vs Gallic Tribes',
      commander: 'Julius Caesar',
      description:
        'Battle of Alesia (52 BC). Caesar besieges Vercingetorix in a double circumvallation, conquering Gaul.',
    },
    {
      name: 'Battle of Gergovia',
      year: -52,
      lat: 45.7167,
      lng: 3.1167,
      outcome: 'defeat',
      combatants: 'Roman Republic vs Gallic Tribes',
      commander: 'Julius Caesar',
      description:
        "Battle of Gergovia (52 BC). Caesar's rare defeat at the hands of Vercingetorix.",
    },
    // Civil Wars of Caesar
    {
      name: 'Battle of Dyrrhachium',
      year: -48,
      lat: 41.3233,
      lng: 19.4522,
      outcome: 'defeat',
      combatants: 'Populares vs Optimates',
      commander: 'Julius Caesar',
      description: 'Battle of Dyrrhachium (48 BC). Caesar suffers a setback against Pompey.',
    },
    {
      name: 'Battle of Pharsalus',
      year: -48,
      lat: 39.3,
      lng: 22.3833,
      outcome: 'victory',
      combatants: 'Populares vs Optimates',
      commander: 'Julius Caesar',
      description: 'Battle of Pharsalus (48 BC). Caesar defeats Pompey, becoming master of Rome.',
    },
    {
      name: 'Battle of Thapsus',
      year: -46,
      lat: 35.6258,
      lng: 11.045,
      outcome: 'victory',
      combatants: 'Populares vs Optimates',
      commander: 'Julius Caesar',
      description: 'Battle of Thapsus (46 BC). Caesar defeats the Optimate remnants in Africa.',
    },
    {
      name: 'Battle of Munda',
      year: -45,
      lat: 37.35,
      lng: -5.2167,
      outcome: 'victory',
      combatants: 'Populares vs Optimates',
      commander: 'Julius Caesar',
      description: "Battle of Munda (45 BC). Caesar's final victory, ending the civil war.",
    },
    // Post-Caesar Civil Wars
    {
      name: 'Battle of Philippi',
      year: -42,
      lat: 41.0131,
      lng: 24.2864,
      outcome: 'victory',
      combatants: 'Triumvirs vs Liberators',
      commander: 'Mark Antony and Octavian',
      description:
        'Battle of Philippi (42 BC). Antony and Octavian avenge Caesar by defeating Brutus and Cassius.',
    },
    {
      name: 'Battle of Naulochus',
      year: -36,
      lat: 38.2167,
      lng: 15.2333,
      outcome: 'victory',
      combatants: 'Octavian vs Sextus Pompey',
      commander: 'Marcus Vipsanius Agrippa',
      description: "Battle of Naulochus (36 BC). Agrippa defeats Sextus Pompey's fleet off Sicily.",
    },
    {
      name: 'Battle of Actium',
      year: -31,
      lat: 38.9344,
      lng: 20.7386,
      outcome: 'victory',
      combatants: 'Octavian vs Mark Antony and Cleopatra',
      commander: 'Marcus Vipsanius Agrippa',
      description:
        'Battle of Actium (31 BC). Octavian defeats Antony and Cleopatra, becoming sole ruler of Rome.',
    },
    // Imperial Period
    {
      name: 'Battle of the Teutoburg Forest',
      year: 9,
      lat: 52.4081,
      lng: 8.1294,
      outcome: 'defeat',
      combatants: 'Roman Empire vs Germanic Tribes',
      commander: 'Publius Quinctilius Varus',
      description:
        'Battle of the Teutoburg Forest (9 AD). Three legions destroyed, halting Roman expansion into Germania.',
    },
    {
      name: 'Battle of Idistaviso',
      year: 16,
      lat: 52.1,
      lng: 9.35,
      outcome: 'victory',
      combatants: 'Roman Empire vs Germanic Tribes',
      commander: 'Germanicus',
      description: 'Battle of Idistaviso (16 AD). Germanicus avenges the Teutoburg Forest defeat.',
    },
    {
      name: 'Battle of the Medway',
      year: 43,
      lat: 51.44,
      lng: 0.742,
      outcome: 'victory',
      combatants: 'Roman Empire vs British Tribes',
      commander: 'Aulus Plautius',
      description: 'Battle of the Medway (43 AD). Key Roman victory in the invasion of Britain.',
    },
    {
      name: 'Battle of Watling Street',
      year: 61,
      lat: 52.6563,
      lng: -1.9271,
      outcome: 'victory',
      combatants: 'Roman Empire vs British Tribes',
      commander: 'Gaius Suetonius Paulinus',
      description:
        "Battle of Watling Street (61 AD). Romans crush Boudica's revolt despite being vastly outnumbered.",
    },
    {
      name: 'Siege of Jerusalem',
      year: 70,
      lat: 31.7767,
      lng: 35.2345,
      outcome: 'victory',
      combatants: 'Roman Empire vs Jewish Rebels',
      commander: 'Titus',
      description:
        'Siege of Jerusalem (70 AD). Titus captures Jerusalem and destroys the Second Temple.',
    },
    {
      name: 'Siege of Masada',
      year: 73,
      lat: 31.3156,
      lng: 35.3536,
      outcome: 'victory',
      combatants: 'Roman Empire vs Jewish Rebels',
      commander: 'Lucius Flavius Silva',
      description:
        'Siege of Masada (73 AD). Romans capture the last Jewish holdout; defenders choose death over slavery.',
    },
    {
      name: 'Battle of Mons Graupius',
      year: 84,
      lat: 56.9167,
      lng: -2.5,
      outcome: 'victory',
      combatants: 'Roman Empire vs Caledonians',
      commander: 'Gnaeus Julius Agricola',
      description:
        'Battle of Mons Graupius (84 AD). Furthest north Roman military victory in Scotland.',
    },
    {
      name: 'Battle of Sarmizegetusa',
      year: 106,
      lat: 45.6225,
      lng: 23.31,
      outcome: 'victory',
      combatants: 'Roman Empire vs Dacia',
      commander: 'Trajan',
      description:
        'Battle of Sarmizegetusa (106 AD). Trajan conquers the Dacian capital, annexing the province.',
    },
    {
      name: 'Battle of Nisibis',
      year: 217,
      lat: 37.0667,
      lng: 41.2167,
      outcome: 'defeat',
      combatants: 'Roman Empire vs Parthian Empire',
      commander: 'Macrinus',
      description: 'Battle of Nisibis (217 AD). Parthian victory forces Rome to pay for peace.',
    },
    {
      name: 'Battle of Edessa',
      year: 260,
      lat: 37.15,
      lng: 38.8,
      outcome: 'defeat',
      combatants: 'Roman Empire vs Sassanid Empire',
      commander: 'Valerian',
      description:
        'Battle of Edessa (260 AD). Emperor Valerian captured alive by Shapur I - unique humiliation.',
    },
    {
      name: 'Battle of Naissus',
      year: 268,
      lat: 43.3,
      lng: 21.9,
      outcome: 'victory',
      combatants: 'Roman Empire vs Goths',
      commander: 'Claudius II',
      description:
        'Battle of Naissus (268 AD). Decisive Roman victory over a massive Gothic invasion force.',
    },
    {
      name: 'Battle of Emesa',
      year: 272,
      lat: 34.7333,
      lng: 36.7167,
      outcome: 'victory',
      combatants: 'Roman Empire vs Palmyrene Empire',
      commander: 'Aurelian',
      description:
        'Battle of Emesa (272 AD). Aurelian defeats Queen Zenobia, reuniting the empire.',
    },
    {
      name: 'Battle of the Milvian Bridge',
      year: 312,
      lat: 41.9356,
      lng: 12.4669,
      outcome: 'victory',
      combatants: 'Constantine vs Maxentius',
      commander: 'Constantine I',
      description:
        "Battle of the Milvian Bridge (312 AD). Constantine's vision and victory, leading to Christianity's rise.",
    },
    {
      name: 'Battle of Chrysopolis',
      year: 324,
      lat: 40.9833,
      lng: 29.0333,
      outcome: 'victory',
      combatants: 'Constantine vs Licinius',
      commander: 'Constantine I',
      description:
        'Battle of Chrysopolis (324 AD). Constantine defeats Licinius, becoming sole emperor.',
    },
    {
      name: 'Battle of Strasbourg',
      year: 357,
      lat: 48.5844,
      lng: 7.7486,
      outcome: 'victory',
      combatants: 'Roman Empire vs Alamanni',
      commander: 'Julian (Caesar)',
      description:
        'Battle of Strasbourg (357 AD). Julian crushes a large Alamanni confederation on the Rhine.',
    },
    {
      name: 'Battle of Ctesiphon',
      year: 363,
      lat: 33.1,
      lng: 44.583,
      outcome: 'victory',
      combatants: 'Roman Empire vs Sassanid Empire',
      commander: 'Julian',
      description:
        'Battle of Ctesiphon (363 AD). Julian wins before the Sassanid capital but retreats; dies shortly after.',
    },
    {
      name: 'Battle of Adrianople',
      year: 378,
      lat: 41.6764,
      lng: 26.5556,
      outcome: 'defeat',
      combatants: 'Eastern Roman Empire vs Goths',
      commander: 'Emperor Valens',
      description:
        'Battle of Adrianople (378 AD). Catastrophic Roman defeat; Emperor Valens killed. Beginning of the end.',
    },
    {
      name: 'Battle of the Frigidus',
      year: 394,
      lat: 45.8704,
      lng: 13.9362,
      outcome: 'victory',
      combatants: 'Eastern vs Western Roman Empire',
      commander: 'Theodosius I',
      description:
        'Battle of the Frigidus (394 AD). Theodosius reunites the empire for the last time.',
    },
    {
      name: 'Battle of Pollentia',
      year: 402,
      lat: 44.6847,
      lng: 7.8959,
      outcome: 'victory',
      combatants: 'Western Roman Empire vs Visigoths',
      commander: 'Stilicho',
      description: "Battle of Pollentia (402 AD). Stilicho checks Alaric's invasion of Italy.",
    },
    {
      name: 'Sack of Rome by Alaric',
      year: 410,
      lat: 41.9,
      lng: 12.5,
      outcome: 'defeat',
      combatants: 'Western Roman Empire vs Visigoths',
      commander: 'None (Honorius in Ravenna)',
      description:
        "Sack of Rome (410 AD). Alaric's Visigoths sack Rome for the first time in 800 years.",
    },
    {
      name: 'Battle of the Catalaunian Plains',
      year: 451,
      lat: 48.95,
      lng: 4.35,
      outcome: 'victory',
      combatants: 'Roman-Visigothic Alliance vs Hunnic Empire',
      commander: 'Flavius Aetius',
      description:
        'Battle of the Catalaunian Plains (451 AD). Aetius and Visigoths halt Attila the Hun in Gaul.',
    },
    {
      name: 'Sack of Rome by Vandals',
      year: 455,
      lat: 41.9,
      lng: 12.5,
      outcome: 'defeat',
      combatants: 'Western Roman Empire vs Vandals',
      commander: 'None',
      description: "Sack of Rome (455 AD). Genseric's Vandals plunder Rome for two weeks.",
    },
    // Additional important battles
    {
      name: 'Battle of Sentinum',
      year: -295,
      lat: 43.4336,
      lng: 12.8583,
      outcome: 'victory',
      combatants: 'Roman Republic vs Samnites and Gauls',
      commander: 'Fabius Maximus Rullianus',
      description: 'Battle of Sentinum (295 BC). Decisive Roman victory in the Third Samnite War.',
    },
    {
      name: 'Battle of the Caudine Forks',
      year: -321,
      lat: 41.0611,
      lng: 14.6333,
      outcome: 'defeat',
      combatants: 'Roman Republic vs Samnites',
      commander: 'Titus Veturius Calvinus',
      description:
        'Battle of the Caudine Forks (321 BC). Humiliating Roman surrender, forced under the yoke.',
    },
    {
      name: 'Battle of the Allia',
      year: -390,
      lat: 41.9785,
      lng: 12.5123,
      outcome: 'defeat',
      combatants: 'Roman Republic vs Gauls',
      commander: 'Quintus Sulpicius',
      description: 'Battle of the Allia (390 BC). Gallic Gauls defeat Rome and sack the city.',
    },
    {
      name: 'Battle of Veii',
      year: -396,
      lat: 42.0239,
      lng: 12.4014,
      outcome: 'victory',
      combatants: 'Roman Republic vs Veii',
      commander: 'Furius Camillus',
      description:
        'Battle of Veii (396 BC). Romans capture the Etruscan rival city after a long siege.',
    },
    {
      name: 'Battle of Lake Regillus',
      year: -496,
      lat: 41.8167,
      lng: 12.6833,
      outcome: 'victory',
      combatants: 'Roman Republic vs Latin League',
      commander: 'Aulus Postumius Albus',
      description: 'Battle of Lake Regillus (496 BC). Early Roman victory over the Latin League.',
    },
    {
      name: 'Battle of Numantia',
      year: -133,
      lat: 41.8083,
      lng: -2.4456,
      outcome: 'victory',
      combatants: 'Roman Republic vs Celtiberians',
      commander: 'Scipio Aemilianus',
      description:
        'Siege of Numantia (133 BC). Scipio destroys the defiant Celtiberian stronghold.',
    },
    {
      name: 'Battle of Telamon',
      year: -225,
      lat: 42.5551,
      lng: 11.1328,
      outcome: 'victory',
      combatants: 'Roman Republic vs Gauls',
      commander: 'Atilius Regulus',
      description:
        'Battle of Telamon (225 BC). Romans trap and destroy a large Gallic army in Tuscany.',
    },
    {
      name: 'Battle of Lugdunum',
      year: 197,
      lat: 45.7597,
      lng: 4.8194,
      outcome: 'victory',
      combatants: 'Septimius Severus vs Clodius Albinus',
      commander: 'Septimius Severus',
      description:
        "Battle of Lugdunum (197 AD). Largest and bloodiest battle of Severus' civil war.",
    },
    {
      name: 'Battle of Abritus',
      year: 251,
      lat: 43.51,
      lng: 26.54,
      outcome: 'defeat',
      combatants: 'Roman Empire vs Goths',
      commander: 'Emperor Decius',
      description:
        'Battle of Abritus (251 AD). Emperor Decius killed, first Roman emperor to die in battle against barbarians.',
    },
    {
      name: 'Battle of Mursa Major',
      year: 351,
      lat: 45.5575,
      lng: 18.6796,
      outcome: 'victory',
      combatants: 'Constantius II vs Magnentius',
      commander: 'Constantius II',
      description: 'Battle of Mursa Major (351 AD). One of the bloodiest Roman civil war battles.',
    },
    {
      name: 'Battle of the Colline Gate',
      year: -82,
      lat: 41.9073,
      lng: 12.4987,
      outcome: 'victory',
      combatants: 'Optimates vs Populares',
      commander: 'Lucius Cornelius Sulla',
      description:
        'Battle of the Colline Gate (82 BC). Sulla seizes Rome, begins his dictatorship.',
    },
    {
      name: 'Battle of Argentoratum',
      year: -58,
      lat: 48.5734,
      lng: 7.7521,
      outcome: 'victory',
      combatants: 'Roman Republic vs Germanic Suebi',
      commander: 'Julius Caesar',
      description:
        'Battle of Argentoratum (58 BC). Caesar drives Ariovistus back across the Rhine.',
    },
    {
      name: 'Battle of Ilerda',
      year: -49,
      lat: 41.617,
      lng: 0.625,
      outcome: 'victory',
      combatants: 'Populares vs Optimates',
      commander: 'Julius Caesar',
      description: "Battle of Ilerda (49 BC). Caesar outmaneuvers Pompey's lieutenants in Spain.",
    },
    {
      name: 'Battle of the Nile',
      year: -47,
      lat: 31.2,
      lng: 29.9167,
      outcome: 'victory',
      combatants: 'Caesar and Cleopatra vs Ptolemy XIII',
      commander: 'Julius Caesar',
      description:
        "Battle of the Nile (47 BC). Caesar defeats Ptolemy XIII, placing Cleopatra on Egypt's throne.",
    },
    {
      name: 'Battle of Issus',
      year: 194,
      lat: 36.8383,
      lng: 36.1644,
      outcome: 'victory',
      combatants: 'Septimius Severus vs Pescennius Niger',
      commander: 'Septimius Severus',
      description:
        'Battle of Issus (194 AD). Severus defeats Niger to consolidate power in the east.',
    },
    {
      name: 'Battle of Cibalae',
      year: 314,
      lat: 45.2833,
      lng: 18.8,
      outcome: 'victory',
      combatants: 'Constantine vs Licinius',
      commander: 'Constantine I',
      description:
        'Battle of Cibalae (314 AD). Constantine defeats Licinius in the first of their wars.',
    },
    {
      name: 'Battle of Amida',
      year: 359,
      lat: 37.917,
      lng: 40.217,
      outcome: 'defeat',
      combatants: 'Roman Empire vs Sassanid Empire',
      commander: 'Ursicinus',
      description:
        'Battle of Amida (359 AD). Shapur II captures the fortress after a brutal 73-day siege.',
    },
  ]

  return curated.map((b) => ({
    ...b,
    id: toKebabCase(b.name),
    source: 'Roman-Battles-Droid',
  }))
}

async function main() {
  console.log('Ingesting Roman battle data...\n')

  // Try to fetch and parse the CSV
  let csvBattles: Battle[] = []
  const csv = await fetchCSV()
  if (csv) {
    csvBattles = parseCsvBattles(csv)
    console.log(`  Parsed ${csvBattles.length} battles from CSV`)
  }

  // Get curated battles
  const curatedBattles = getCuratedBattles()
  console.log(`  ${curatedBattles.length} hand-curated battles`)

  // Merge: curated battles take priority (better data quality)
  const battleMap = new Map<string, Battle>()

  // Add CSV battles first
  for (const b of csvBattles) {
    battleMap.set(b.id, b)
  }

  // Overwrite/add curated battles (higher quality)
  for (const b of curatedBattles) {
    battleMap.set(b.id, b)
  }

  // Sort by year
  const allBattles = Array.from(battleMap.values()).sort((a, b) => a.year - b.year)

  console.log(`\n  Total unique battles: ${allBattles.length}`)

  // Ensure output directory exists
  const outDir = fileURLToPath(new URL('../src/data/battles', import.meta.url))
  await mkdir(outDir, { recursive: true })

  // Write output
  const outPath = fileURLToPath(new URL('../src/data/battles/battles.json', import.meta.url))
  const json = JSON.stringify(allBattles, null, 2)
  await writeFile(outPath, json + '\n')

  console.log(`  Written to ${outPath}`)
  console.log(`  File size: ${(json.length / 1024).toFixed(1)} KB`)

  // Stats
  const victories = allBattles.filter((b) => b.outcome === 'victory').length
  const defeats = allBattles.filter((b) => b.outcome === 'defeat').length
  const draws = allBattles.filter((b) => b.outcome === 'draw').length
  const unknown = allBattles.filter((b) => b.outcome === 'unknown').length
  console.log(
    `\n  Outcomes: ${victories} victories, ${defeats} defeats, ${draws} draws, ${unknown} unknown`,
  )
  console.log(`  Date range: ${allBattles[0].year} to ${allBattles[allBattles.length - 1].year}`)

  console.log('\nBattle ingestion complete')
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
