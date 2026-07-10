/**
 * Appends curated Byzantine (Eastern Roman) emperors and pivotal battles/sieges
 * (post-476) to emperors.json and battles.json, so the extended 476–1453 timeline
 * isn't empty. Idempotent: strips prior entries tagged `byzantine-curated`.
 *
 * Dates/reigns are well-established; battle coordinates are placed at the known
 * site (Constantinople sieges at the city). Usage: npx tsx scripts/add-byzantine-events.ts
 */

const TAG = 'byzantine-curated'

interface Emperor {
  id: string
  name: string
  reignStart: number
  reignEnd: number
  born: number | null
  died: number | null
  birthPlace: string | null
  birthLat: number | null
  birthLng: number | null
  dynasty: string | null
  riseType: string
  causeOfDeath: string | null
  description: string
  source: string
}
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

// reign start, reign end, dynasty, one-line significance
const E: [string, number, number, string | null, string][] = [
  [
    'Zeno',
    474,
    491,
    'Leonid',
    'Presided over the 476 deposition of the last Western emperor; the East endured.',
  ],
  [
    'Anastasius I',
    491,
    518,
    'Leonid',
    'A shrewd administrator who reformed the coinage and left a full treasury.',
  ],
  [
    'Justin I',
    518,
    527,
    'Justinian',
    'A peasant-born soldier who rose to the throne and founded a dynasty.',
  ],
  [
    'Justinian I',
    527,
    565,
    'Justinian',
    'The last great Roman emperor: reconquered Italy and Africa, codified Roman law, and built the Hagia Sophia.',
  ],
  [
    'Justin II',
    565,
    578,
    'Justinian',
    'Inherited an overstretched empire and faced war on every frontier.',
  ],
  [
    'Tiberius II',
    578,
    582,
    'Justinian',
    'A generous ruler remembered for emptying the treasury Justin had refilled.',
  ],
  [
    'Maurice',
    582,
    602,
    'Justinian',
    'A capable general-emperor whose overthrow triggered decades of catastrophe.',
  ],
  ['Phocas', 602, 610, null, 'A usurping centurion whose brutal reign nearly broke the empire.'],
  [
    'Heraclius',
    610,
    641,
    'Heraclian',
    'Crushed the Persian Empire in an epic counterattack — then watched the Arab conquests begin.',
  ],
  [
    'Constans II',
    641,
    668,
    'Heraclian',
    'Fought the rising Caliphate and moved the court west toward Sicily.',
  ],
  [
    'Constantine IV',
    668,
    685,
    'Heraclian',
    'Repelled the first Arab siege of Constantinople with Greek fire, saving Europe.',
  ],
  [
    'Justinian II',
    685,
    695,
    'Heraclian',
    'Mutilated and deposed, he would return a decade later to reclaim the throne.',
  ],
  [
    'Leo III',
    717,
    741,
    'Isaurian',
    'Broke the great Arab siege of 717–718 and launched the Iconoclast controversy.',
  ],
  [
    'Constantine V',
    741,
    775,
    'Isaurian',
    'A brilliant, ruthless soldier-emperor and fierce iconoclast.',
  ],
  [
    'Irene',
    797,
    802,
    'Isaurian',
    'The first woman to rule the empire in her own name; restored the icons.',
  ],
  [
    'Nikephoros I',
    802,
    811,
    null,
    'A reforming finance-minister-turned-emperor, killed in battle against the Bulgars.',
  ],
  [
    'Michael II',
    820,
    829,
    'Amorian',
    'Founded the Amorian dynasty amid revolt and the loss of Crete.',
  ],
  [
    'Theophilos',
    829,
    842,
    'Amorian',
    'A cultured, justice-loving emperor and the last committed iconoclast.',
  ],
  [
    'Michael III',
    842,
    867,
    'Amorian',
    'Under him icons were restored and the Byzantine cultural revival began.',
  ],
  [
    'Basil I',
    867,
    886,
    'Macedonian',
    'A Macedonian peasant who murdered his way to the throne and founded its greatest dynasty.',
  ],
  [
    'Leo VI',
    886,
    912,
    'Macedonian',
    '"The Wise" — a scholar-emperor who recodified the law in Greek.',
  ],
  [
    'Constantine VII',
    913,
    959,
    'Macedonian',
    '"Born in the purple" — scholar-emperor who wrote the empire\'s handbooks of statecraft.',
  ],
  [
    'Nikephoros II',
    963,
    969,
    'Macedonian',
    'A warrior-emperor who reconquered Crete, Cyprus and Antioch.',
  ],
  [
    'John I Tzimiskes',
    969,
    976,
    'Macedonian',
    'Drove Byzantine arms deep into Syria and the Holy Land.',
  ],
  [
    'Basil II',
    976,
    1025,
    'Macedonian',
    '"The Bulgar-Slayer" — brought the empire to its medieval zenith, from the Danube to Syria.',
  ],
  [
    'Constantine VIII',
    1025,
    1028,
    'Macedonian',
    "The last male Macedonian; his reign began the dynasty's decline.",
  ],
  [
    'Romanos III',
    1028,
    1034,
    'Macedonian',
    'An overambitious emperor whose failures weakened the eastern frontier.',
  ],
  [
    'Constantine IX',
    1042,
    1055,
    'Macedonian',
    'Presided over cultural splendour and the 1054 schism with Rome.',
  ],
  [
    'Constantine X',
    1059,
    1067,
    'Doukas',
    'Cut the army to save money — just as the Seljuk Turks arrived.',
  ],
  [
    'Romanos IV',
    1068,
    1071,
    'Doukas',
    'Led the army to catastrophe at Manzikert, opening Anatolia to the Turks.',
  ],
  ['Michael VII', 1071, 1078, 'Doukas', 'A bookish emperor who watched Asia Minor slip away.'],
  [
    'Alexios I Komnenos',
    1081,
    1118,
    'Komnenian',
    'Rescued the empire from collapse and shrewdly harnessed the First Crusade.',
  ],
  [
    'John II Komnenos',
    1118,
    1143,
    'Komnenian',
    'Perhaps the finest of the Komnenoi — a tireless, upright soldier-emperor.',
  ],
  [
    'Manuel I Komnenos',
    1143,
    1180,
    'Komnenian',
    'A dazzling, ambitious ruler whose overreach ended at Myriokephalon.',
  ],
  [
    'Andronikos I',
    1183,
    1185,
    'Komnenian',
    "A tyrannical reformer whose fall unleashed the empire's unravelling.",
  ],
  ['Isaac II Angelos', 1185, 1195, 'Angelos', 'His weak, corrupt rule hastened the road to 1204.'],
  ['Alexios III', 1195, 1203, 'Angelos', 'Fled as the Fourth Crusade closed on the capital.'],
  [
    'Theodore I Laskaris',
    1205,
    1221,
    'Laskarid',
    'Founded the Empire of Nicaea, keeper of the Byzantine flame in exile.',
  ],
  [
    'John III Vatatzes',
    1221,
    1254,
    'Laskarid',
    'Rebuilt Byzantine power in exile and encircled Latin Constantinople.',
  ],
  [
    'Michael VIII',
    1259,
    1282,
    'Palaiologan',
    'Recaptured Constantinople in 1261 and restored the empire — its last founder.',
  ],
  [
    'Andronikos II',
    1282,
    1328,
    'Palaiologan',
    'A pious scholar-emperor under whom the army and navy withered.',
  ],
  [
    'Andronikos III',
    1328,
    1341,
    'Palaiologan',
    'Fought to hold Anatolia as the Ottoman emirate rose across the strait.',
  ],
  [
    'John V',
    1341,
    1391,
    'Palaiologan',
    'Ruled a shrinking, tributary state and travelled west begging for aid.',
  ],
  [
    'Manuel II',
    1391,
    1425,
    'Palaiologan',
    'A learned emperor who toured Europe seeking help against the Ottomans.',
  ],
  [
    'John VIII',
    1425,
    1448,
    'Palaiologan',
    'Sought union with Rome at Florence to save a city already all but lost.',
  ],
  [
    'Constantine XI',
    1449,
    1453,
    'Palaiologan',
    'The last Roman emperor, who died sword in hand on the walls as Constantinople fell.',
  ],
]

// name, year, lat, lng, outcome (Byzantine POV), opponent, commander, description
const B: [string, number, number, number, Battle['outcome'], string, string, string][] = [
  [
    'Battle of Yarmouk',
    636,
    32.72,
    35.98,
    'defeat',
    'Rashidun Caliphate',
    'Vahan',
    'A six-day disaster on the Yarmouk river that lost Syria and the Levant to the Arabs forever.',
  ],
  [
    'Arab Siege of Constantinople',
    678,
    41.01,
    28.98,
    'victory',
    'Umayyad Caliphate',
    'Constantine IV',
    'The first great Arab siege, broken by the walls and the terrifying new weapon of Greek fire.',
  ],
  [
    'Second Arab Siege of Constantinople',
    718,
    41.01,
    28.98,
    'victory',
    'Umayyad Caliphate',
    'Leo III',
    'Leo III shattered the largest Muslim assault on the city — a turning point for all of Europe.',
  ],
  [
    'Battle of Akroinon',
    740,
    38.76,
    30.54,
    'victory',
    'Umayyad Caliphate',
    'Leo III',
    'A decisive victory in Anatolia that ended the tide of Umayyad invasions.',
  ],
  [
    'Battle of Lalakaon',
    863,
    41.5,
    35.0,
    'victory',
    'Emirate of Melitene',
    'Petronas',
    "Annihilated the raiding emir Umar al-Aqta and swung the eastern frontier in Byzantium's favour.",
  ],
  [
    'Battle of Kleidion',
    1014,
    41.36,
    22.98,
    'victory',
    'Bulgarian Empire',
    'Basil II',
    'Basil II\'s crushing victory that earned him the name "Bulgar-Slayer" and ended the Bulgarian war.',
  ],
  [
    'Battle of Manzikert',
    1071,
    39.15,
    42.54,
    'defeat',
    'Seljuk Empire',
    'Romanos IV',
    'The catastrophe that captured an emperor and opened the Anatolian heartland to the Turks.',
  ],
  [
    'Battle of Dyrrhachium',
    1081,
    41.32,
    19.45,
    'defeat',
    'Normans',
    'Alexios I',
    "Robert Guiscard's Normans routed Alexios I, though the empire would recover under him.",
  ],
  [
    'Battle of Myriokephalon',
    1176,
    38.03,
    31.16,
    'defeat',
    'Sultanate of Rum',
    'Manuel I',
    'An ambush in a mountain pass that ended Byzantine hopes of retaking Anatolia.',
  ],
  [
    'Sack of Constantinople',
    1204,
    41.01,
    28.98,
    'defeat',
    'Fourth Crusade',
    'Alexios V',
    'Christian crusaders stormed and looted the capital — a wound the empire never truly recovered from.',
  ],
  [
    'Recapture of Constantinople',
    1261,
    41.01,
    28.98,
    'victory',
    'Latin Empire',
    'Alexios Strategopoulos',
    'A small Byzantine force slipped into the city and restored the empire under Michael VIII.',
  ],
  [
    'Battle of Pelekanon',
    1329,
    40.77,
    29.52,
    'defeat',
    'Ottoman Beylik',
    'Andronikos III',
    "The last field attempt to save Byzantine Bithynia failed against Orhan's Ottomans.",
  ],
  [
    'Fall of Constantinople',
    1453,
    41.01,
    28.98,
    'defeat',
    'Ottoman Empire',
    'Constantine XI',
    "Mehmed II's cannon breached the Theodosian Walls; the last Roman emperor fell and the empire ended.",
  ],
]

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function main() {
  const { readFile, writeFile } = await import('fs/promises')
  const { fileURLToPath } = await import('url')
  const empPath = fileURLToPath(new URL('../src/data/emperors/emperors.json', import.meta.url))
  const batPath = fileURLToPath(new URL('../src/data/battles/battles.json', import.meta.url))

  const emperors: Emperor[] = JSON.parse(await readFile(empPath, 'utf-8')).filter(
    (e: Emperor) => e.source !== TAG,
  )
  for (const [name, rs, re, dynasty, description] of E) {
    emperors.push({
      id: slug(name) + '-' + rs,
      name,
      reignStart: rs,
      reignEnd: re,
      born: null,
      died: null,
      birthPlace: null,
      birthLat: null,
      birthLng: null,
      dynasty,
      riseType: 'inherited',
      causeOfDeath: null,
      description,
      source: TAG,
    })
  }
  emperors.sort((a, b) => a.reignStart - b.reignStart)
  await writeFile(empPath, JSON.stringify(emperors, null, 2) + '\n')
  console.log(`✓ emperors.json: ${emperors.length} total (+${E.length} Byzantine)`)

  const battles: Battle[] = JSON.parse(await readFile(batPath, 'utf-8')).filter(
    (b: Battle) => b.source !== TAG,
  )
  for (const [name, year, lat, lng, outcome, opponent, commander, description] of B) {
    battles.push({
      id: slug(name) + '-' + year,
      name,
      year,
      lat,
      lng,
      outcome,
      combatants: `Byzantine Empire vs ${opponent}`,
      commander,
      description,
      source: TAG,
    })
  }
  battles.sort((a, b) => a.year - b.year)
  await writeFile(batPath, JSON.stringify(battles, null, 2) + '\n')
  console.log(`✓ battles.json: ${battles.length} total (+${B.length} Byzantine)`)
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
