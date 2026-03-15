/**
 * Script to fetch and process Roman coin mint data.
 * Source: https://nomisma.org
 *
 * Strategy:
 * 1. Query Nomisma.org SPARQL for all mints
 * 2. Fetch individual JSON-LD pages for coordinates
 * 3. Fall back to curated dataset for mints missing data
 *
 * Usage: npx tsx scripts/ingest-coin-mints.ts
 */

import { writeFile, mkdir } from 'fs/promises'
import { fileURLToPath } from 'url'

interface CoinMint {
  id: string
  name: string
  lat: number
  lng: number
  mintType: 'imperial' | 'provincial' | 'republican' | 'greek' | 'unknown'
  startYear: number | null
  endYear: number | null
  description: string
  source: string
}

function truncateCoord(n: number): number {
  return Math.round(n * 10000) / 10000
}

function slugify(text: string): string {
  return (
    'mint-' +
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  )
}

// ── Nomisma SPARQL: get all mint IDs and labels ──────────────────────────

interface SparqlBinding {
  mint: { value: string }
  label: { value: string }
}

async function fetchMintList(): Promise<{ id: string; label: string }[]> {
  const query = `
PREFIX nmo: <http://nomisma.org/ontology#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT ?mint ?label WHERE {
  ?mint a nmo:Mint .
  ?mint skos:prefLabel ?label .
  FILTER(lang(?label) = "en")
} ORDER BY ?label
`.trim()

  const url = `https://nomisma.org/query?query=${encodeURIComponent(query)}&output=json`
  console.log('Fetching mint list from Nomisma SPARQL...')

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/sparql-results+json' },
    })
    if (!res.ok) throw new Error(`SPARQL returned ${res.status}`)
    const data = (await res.json()) as { results: { bindings: SparqlBinding[] } }
    const mints = data.results.bindings.map((b) => ({
      id: b.mint.value.replace('http://nomisma.org/id/', ''),
      label: b.label.value,
    }))
    console.log(`  Found ${mints.length} mints in SPARQL`)
    return mints
  } catch (err) {
    console.log(`  SPARQL failed: ${(err as Error).message}`)
    return []
  }
}

// ── Fetch individual JSON-LD for coordinates ─────────────────────────────

interface JsonLdGraph {
  '@graph'?: JsonLdNode[]
  '@id'?: string
  'geo:lat'?: { '@value': string }
  'geo:long'?: { '@value': string }
  'skos:definition'?: { '@value': string } | Array<{ '@value': string; '@language'?: string }>
  'skos:broader'?: { '@id': string }
}

interface JsonLdNode {
  '@id'?: string
  '@type'?: string | string[]
  'geo:lat'?: { '@value': string } | string
  'geo:long'?: { '@value': string } | string
  'skos:definition'?:
    | { '@value': string; '@language'?: string }
    | Array<{ '@value': string; '@language'?: string }>
  'skos:broader'?: { '@id': string } | Array<{ '@id': string }>
}

async function fetchMintJsonLd(
  mintId: string,
): Promise<{ lat: number; lng: number; definition: string; broader: string } | null> {
  const url = `https://nomisma.org/id/${mintId}.jsonld`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as JsonLdGraph

    let lat: number | null = null
    let lng: number | null = null
    let definition = ''
    let broader = ''

    const nodes = data['@graph'] || [data]
    for (const node of nodes) {
      // Coordinates
      if (node['geo:lat'] && node['geo:long']) {
        const rawLat = node['geo:lat']
        const rawLng = node['geo:long']
        lat =
          typeof rawLat === 'string'
            ? parseFloat(rawLat)
            : parseFloat((rawLat as { '@value': string })['@value'])
        lng =
          typeof rawLng === 'string'
            ? parseFloat(rawLng)
            : parseFloat((rawLng as { '@value': string })['@value'])
      }

      // Definition
      if (node['skos:definition']) {
        const def = node['skos:definition']
        if (Array.isArray(def)) {
          const en = def.find((d) => d['@language'] === 'en')
          if (en) definition = en['@value']
          else if (def.length > 0) definition = def[0]['@value']
        } else if (typeof def === 'object' && def['@value']) {
          definition = def['@value']
        }
      }

      // Broader
      if (node['skos:broader']) {
        const b = node['skos:broader']
        if (Array.isArray(b)) {
          broader = b
            .map((x) => x['@id']?.replace('nm:', '').replace('http://nomisma.org/id/', ''))
            .join(', ')
        } else if (typeof b === 'object' && b['@id']) {
          broader = b['@id'].replace('nm:', '').replace('http://nomisma.org/id/', '')
        }
      }
    }

    if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
      return { lat, lng, definition, broader }
    }
    return null
  } catch {
    return null
  }
}

// ── Curated fallback data ────────────────────────────────────────────────

const CURATED_MINTS: CoinMint[] = [
  // Major Imperial mints
  {
    id: 'mint-roma',
    name: 'Roma',
    lat: 41.8933,
    lng: 12.4829,
    mintType: 'imperial',
    startYear: -269,
    endYear: 476,
    description: 'Primary mint of the Roman Republic and Empire',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-lugdunum',
    name: 'Lugdunum',
    lat: 45.7597,
    lng: 4.8194,
    mintType: 'imperial',
    startYear: -15,
    endYear: 423,
    description: 'Major imperial mint in Gaul (modern Lyon)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-treveri',
    name: 'Treveri',
    lat: 49.7567,
    lng: 6.6413,
    mintType: 'imperial',
    startYear: 291,
    endYear: 430,
    description: 'Imperial mint at Augusta Treverorum (modern Trier)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-siscia',
    name: 'Siscia',
    lat: 45.4869,
    lng: 16.3731,
    mintType: 'imperial',
    startYear: 262,
    endYear: 387,
    description: 'Imperial mint in Pannonia (modern Sisak, Croatia)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-sirmium',
    name: 'Sirmium',
    lat: 44.9706,
    lng: 19.6131,
    mintType: 'imperial',
    startYear: 320,
    endYear: 395,
    description: 'Imperial mint and tetrarchic capital in Pannonia',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-thessalonica',
    name: 'Thessalonica',
    lat: 40.6401,
    lng: 22.9444,
    mintType: 'imperial',
    startYear: 298,
    endYear: 461,
    description: 'Major imperial mint in Macedonia',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-nicomedia',
    name: 'Nicomedia',
    lat: 40.7631,
    lng: 29.9194,
    mintType: 'imperial',
    startYear: 294,
    endYear: 474,
    description: 'Imperial mint and tetrarchic capital in Bithynia',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-constantinople',
    name: 'Constantinople',
    lat: 41.0082,
    lng: 28.9784,
    mintType: 'imperial',
    startYear: 326,
    endYear: 476,
    description: 'Imperial mint at the new eastern capital',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-antioch',
    name: 'Antioch',
    lat: 36.2,
    lng: 36.15,
    mintType: 'imperial',
    startYear: -64,
    endYear: 474,
    description: 'Major imperial mint in Syria',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-alexandria',
    name: 'Alexandria',
    lat: 31.1981,
    lng: 29.9192,
    mintType: 'imperial',
    startYear: -30,
    endYear: 474,
    description: 'Imperial mint in Egypt, major provincial coinage',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-carthage',
    name: 'Carthage',
    lat: 36.8528,
    lng: 10.3233,
    mintType: 'imperial',
    startYear: 296,
    endYear: 439,
    description: 'Imperial mint in North Africa',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-londinium',
    name: 'Londinium',
    lat: 51.5074,
    lng: -0.1278,
    mintType: 'imperial',
    startYear: 286,
    endYear: 326,
    description: 'Imperial mint in Britain (modern London)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-ticinum',
    name: 'Ticinum',
    lat: 45.1847,
    lng: 9.1582,
    mintType: 'imperial',
    startYear: 274,
    endYear: 326,
    description: 'Imperial mint in northern Italy (modern Pavia)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-aquileia',
    name: 'Aquileia',
    lat: 45.7685,
    lng: 13.3687,
    mintType: 'imperial',
    startYear: 294,
    endYear: 425,
    description: 'Imperial mint in northeastern Italy',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-mediolanum',
    name: 'Mediolanum',
    lat: 45.4642,
    lng: 9.19,
    mintType: 'imperial',
    startYear: 254,
    endYear: 423,
    description: 'Imperial mint in northern Italy (modern Milan)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-cyzicus',
    name: 'Cyzicus',
    lat: 40.3874,
    lng: 27.8836,
    mintType: 'imperial',
    startYear: 268,
    endYear: 474,
    description: 'Imperial mint in Mysia (northwestern Asia Minor)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-heraclea',
    name: 'Heraclea',
    lat: 41.0044,
    lng: 27.9239,
    mintType: 'imperial',
    startYear: 291,
    endYear: 474,
    description: 'Imperial mint in Thrace (modern Marmara Ereğlisi)',
    source: 'Nomisma.org',
  },
  // Additional imperial mints
  {
    id: 'mint-arelate',
    name: 'Arelate',
    lat: 43.6777,
    lng: 4.6308,
    mintType: 'imperial',
    startYear: 313,
    endYear: 475,
    description: 'Imperial mint in southern Gaul (modern Arles)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-ravenna',
    name: 'Ravenna',
    lat: 44.4157,
    lng: 12.1966,
    mintType: 'imperial',
    startYear: 402,
    endYear: 476,
    description: 'Late Roman imperial mint and western capital',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-ambianum',
    name: 'Ambianum',
    lat: 49.894,
    lng: 2.302,
    mintType: 'imperial',
    startYear: 350,
    endYear: 395,
    description: 'Imperial mint in Gaul (modern Amiens)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-serdica',
    name: 'Serdica',
    lat: 42.6977,
    lng: 23.3219,
    mintType: 'imperial',
    startYear: 303,
    endYear: 308,
    description: 'Imperial mint in Thrace (modern Sofia)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-ostia',
    name: 'Ostia',
    lat: 41.7567,
    lng: 12.2917,
    mintType: 'imperial',
    startYear: 308,
    endYear: 313,
    description: 'Short-lived imperial mint at the port of Rome',
    source: 'Nomisma.org',
  },
  // Republican mints
  {
    id: 'mint-capua',
    name: 'Capua',
    lat: 41.1067,
    lng: 14.2133,
    mintType: 'republican',
    startYear: -216,
    endYear: -211,
    description: 'Republican mint in Campania during the Second Punic War',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-brundisium',
    name: 'Brundisium',
    lat: 40.6382,
    lng: 17.9462,
    mintType: 'republican',
    startYear: -215,
    endYear: -150,
    description: 'Republican mint in southeastern Italy (modern Brindisi)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-luceria',
    name: 'Luceria',
    lat: 41.5083,
    lng: 15.3353,
    mintType: 'republican',
    startYear: -211,
    endYear: -170,
    description: 'Republican mint in Apulia',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-narbo',
    name: 'Narbo',
    lat: 43.1843,
    lng: 2.9992,
    mintType: 'republican',
    startYear: -118,
    endYear: -45,
    description: 'Republican mint in southern Gaul (modern Narbonne)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-emerita-augusta',
    name: 'Emerita Augusta',
    lat: 38.9161,
    lng: -6.3431,
    mintType: 'imperial',
    startYear: -25,
    endYear: 54,
    description: 'Imperial mint in Lusitania (modern Mérida)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-caesaraugusta',
    name: 'Caesaraugusta',
    lat: 41.6561,
    lng: -0.8773,
    mintType: 'imperial',
    startYear: -27,
    endYear: 37,
    description: 'Imperial mint in Hispania (modern Zaragoza)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-tarraco',
    name: 'Tarraco',
    lat: 41.1189,
    lng: 1.2445,
    mintType: 'imperial',
    startYear: -27,
    endYear: 41,
    description: 'Imperial mint in Hispania Tarraconensis',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-colonia-patricia',
    name: 'Colonia Patricia',
    lat: 37.8847,
    lng: -4.7792,
    mintType: 'imperial',
    startYear: -13,
    endYear: 14,
    description: 'Imperial mint in Baetica (modern Córdoba)',
    source: 'Nomisma.org',
  },
  // Provincial mints (Greek Imperial coinage)
  {
    id: 'mint-pergamum',
    name: 'Pergamum',
    lat: 39.1217,
    lng: 27.1839,
    mintType: 'provincial',
    startYear: -133,
    endYear: 268,
    description: 'Provincial mint in Mysia, former Attalid capital',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-ephesus',
    name: 'Ephesus',
    lat: 37.9392,
    lng: 27.3417,
    mintType: 'provincial',
    startYear: -133,
    endYear: 268,
    description: 'Major provincial mint in Ionia',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-smyrna',
    name: 'Smyrna',
    lat: 38.4192,
    lng: 27.1287,
    mintType: 'provincial',
    startYear: -200,
    endYear: 268,
    description: 'Provincial mint in Ionia',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-sardis',
    name: 'Sardis',
    lat: 38.4892,
    lng: 28.0408,
    mintType: 'provincial',
    startYear: -133,
    endYear: 268,
    description: 'Provincial mint in Lydia, famous for early coinage',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-tarsus',
    name: 'Tarsus',
    lat: 36.9167,
    lng: 34.8833,
    mintType: 'provincial',
    startYear: -164,
    endYear: 268,
    description: 'Provincial mint in Cilicia',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-side',
    name: 'Side',
    lat: 36.7667,
    lng: 31.3897,
    mintType: 'provincial',
    startYear: -200,
    endYear: 268,
    description: 'Provincial mint in Pamphylia',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-caesarea-cappadocia',
    name: 'Caesarea Cappadociae',
    lat: 38.7333,
    lng: 35.4833,
    mintType: 'provincial',
    startYear: -17,
    endYear: 268,
    description: 'Provincial mint in Cappadocia (modern Kayseri)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-corinth',
    name: 'Corinth',
    lat: 37.9064,
    lng: 22.8799,
    mintType: 'provincial',
    startYear: -146,
    endYear: 268,
    description: 'Provincial mint in Achaea, refounded as Roman colony',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-philippopolis',
    name: 'Philippopolis',
    lat: 42.15,
    lng: 24.75,
    mintType: 'provincial',
    startYear: 46,
    endYear: 268,
    description: 'Provincial mint in Thrace (modern Plovdiv)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-marcianopolis',
    name: 'Marcianopolis',
    lat: 43.2847,
    lng: 27.3478,
    mintType: 'provincial',
    startYear: 138,
    endYear: 268,
    description: 'Provincial mint in Moesia Inferior',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-nicopolis-ad-istrum',
    name: 'Nicopolis ad Istrum',
    lat: 43.2167,
    lng: 25.6167,
    mintType: 'provincial',
    startYear: 98,
    endYear: 268,
    description: 'Provincial mint in Moesia Inferior',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-viminacium',
    name: 'Viminacium',
    lat: 44.7406,
    lng: 21.2106,
    mintType: 'provincial',
    startYear: 239,
    endYear: 255,
    description: 'Provincial mint in Moesia Superior (modern Kostolac)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-deultum',
    name: 'Deultum',
    lat: 42.4,
    lng: 27.0333,
    mintType: 'provincial',
    startYear: 69,
    endYear: 253,
    description: 'Provincial mint in Thrace',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-pautalia',
    name: 'Pautalia',
    lat: 42.4333,
    lng: 22.9333,
    mintType: 'provincial',
    startYear: 98,
    endYear: 218,
    description: 'Provincial mint in Thrace (modern Kyustendil)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-anchialus',
    name: 'Anchialus',
    lat: 42.6833,
    lng: 27.45,
    mintType: 'provincial',
    startYear: 138,
    endYear: 244,
    description: 'Provincial mint in Thrace (modern Pomorie)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-hadrianopolis',
    name: 'Hadrianopolis',
    lat: 41.6694,
    lng: 26.5561,
    mintType: 'provincial',
    startYear: 117,
    endYear: 268,
    description: 'Provincial mint in Thrace (modern Edirne)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-tomis',
    name: 'Tomis',
    lat: 44.1733,
    lng: 28.6383,
    mintType: 'provincial',
    startYear: -72,
    endYear: 268,
    description: 'Provincial mint in Moesia Inferior (modern Constanța)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-nicaea',
    name: 'Nicaea',
    lat: 40.4289,
    lng: 29.72,
    mintType: 'provincial',
    startYear: -72,
    endYear: 268,
    description: 'Provincial mint in Bithynia (modern Iznik)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-byzantium',
    name: 'Byzantium',
    lat: 41.0082,
    lng: 28.9784,
    mintType: 'provincial',
    startYear: -340,
    endYear: 268,
    description: 'Provincial mint, later refounded as Constantinople',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-aelia-capitolina',
    name: 'Aelia Capitolina',
    lat: 31.7683,
    lng: 35.2137,
    mintType: 'provincial',
    startYear: 130,
    endYear: 268,
    description: 'Provincial mint at Roman Jerusalem',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-bostra',
    name: 'Bostra',
    lat: 32.5174,
    lng: 36.4817,
    mintType: 'provincial',
    startYear: 106,
    endYear: 253,
    description: 'Provincial mint in Arabia Petraea',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-neapolis-samaria',
    name: 'Neapolis Samariae',
    lat: 32.2229,
    lng: 35.2544,
    mintType: 'provincial',
    startYear: 72,
    endYear: 253,
    description: 'Provincial mint in Samaria (modern Nablus)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-caesarea-maritima',
    name: 'Caesarea Maritima',
    lat: 32.4981,
    lng: 34.8868,
    mintType: 'provincial',
    startYear: -22,
    endYear: 268,
    description: 'Provincial mint in Judaea/Syria Palaestina',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-tyre',
    name: 'Tyre',
    lat: 33.2706,
    lng: 35.2033,
    mintType: 'provincial',
    startYear: -274,
    endYear: 268,
    description: 'Major Phoenician and provincial mint',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-sidon',
    name: 'Sidon',
    lat: 33.5617,
    lng: 35.3717,
    mintType: 'provincial',
    startYear: -400,
    endYear: 268,
    description: 'Phoenician and provincial mint',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-berytus',
    name: 'Berytus',
    lat: 33.8938,
    lng: 35.5018,
    mintType: 'provincial',
    startYear: -15,
    endYear: 253,
    description: 'Provincial mint in Phoenicia (modern Beirut)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-emesa',
    name: 'Emesa',
    lat: 34.7273,
    lng: 36.7238,
    mintType: 'provincial',
    startYear: 72,
    endYear: 253,
    description: 'Provincial mint in Syria (modern Homs)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-laodicea-syria',
    name: 'Laodicea ad Mare',
    lat: 35.5231,
    lng: 35.7817,
    mintType: 'provincial',
    startYear: -47,
    endYear: 268,
    description: 'Provincial mint in Syria (modern Latakia)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-cyrrhus',
    name: 'Cyrrhus',
    lat: 36.75,
    lng: 36.95,
    mintType: 'provincial',
    startYear: 98,
    endYear: 253,
    description: 'Provincial mint in Syria',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-zeugma',
    name: 'Zeugma',
    lat: 37.0583,
    lng: 37.8667,
    mintType: 'provincial',
    startYear: 17,
    endYear: 253,
    description: 'Provincial mint on the Euphrates',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-samosata',
    name: 'Samosata',
    lat: 37.5431,
    lng: 38.4914,
    mintType: 'provincial',
    startYear: 72,
    endYear: 253,
    description: 'Provincial mint in Commagene',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-edessa',
    name: 'Edessa',
    lat: 37.1589,
    lng: 38.7922,
    mintType: 'provincial',
    startYear: 163,
    endYear: 253,
    description: 'Provincial mint in Osroene (modern Şanlıurfa)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-carrhae',
    name: 'Carrhae',
    lat: 36.8667,
    lng: 39.0333,
    mintType: 'provincial',
    startYear: 163,
    endYear: 253,
    description: 'Provincial mint in Mesopotamia (modern Harran)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-singara',
    name: 'Singara',
    lat: 36.3333,
    lng: 41.85,
    mintType: 'provincial',
    startYear: 239,
    endYear: 253,
    description: 'Provincial mint in northern Mesopotamia',
    source: 'Nomisma.org',
  },
  // Greek mints used by Rome
  {
    id: 'mint-athens',
    name: 'Athens',
    lat: 37.9715,
    lng: 23.7267,
    mintType: 'greek',
    startYear: -510,
    endYear: 268,
    description: 'Famous Athenian mint producing owl tetradrachms',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-syracuse',
    name: 'Syracuse',
    lat: 37.0755,
    lng: 15.2866,
    mintType: 'greek',
    startYear: -480,
    endYear: -212,
    description: 'Major Greek mint in Sicily',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-tarentum',
    name: 'Tarentum',
    lat: 40.4764,
    lng: 17.2296,
    mintType: 'greek',
    startYear: -500,
    endYear: -209,
    description: 'Major Greek mint in Magna Graecia',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-croton',
    name: 'Croton',
    lat: 39.0813,
    lng: 17.1156,
    mintType: 'greek',
    startYear: -550,
    endYear: -200,
    description: 'Greek mint in Bruttium (Magna Graecia)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-neapolis-campania',
    name: 'Neapolis Campaniae',
    lat: 40.8518,
    lng: 14.2681,
    mintType: 'greek',
    startYear: -475,
    endYear: -200,
    description: 'Greek mint in Campania (modern Naples)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-metapontum',
    name: 'Metapontum',
    lat: 40.3883,
    lng: 16.8264,
    mintType: 'greek',
    startYear: -550,
    endYear: -200,
    description: 'Greek mint in Lucania',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-thurium',
    name: 'Thurium',
    lat: 39.7167,
    lng: 16.5333,
    mintType: 'greek',
    startYear: -443,
    endYear: -194,
    description: 'Greek mint in Lucania',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-velia',
    name: 'Velia',
    lat: 40.1611,
    lng: 15.1497,
    mintType: 'greek',
    startYear: -535,
    endYear: -250,
    description: 'Greek mint in Lucania',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-rhegium',
    name: 'Rhegium',
    lat: 38.1114,
    lng: 15.6469,
    mintType: 'greek',
    startYear: -494,
    endYear: -200,
    description: 'Greek mint at the toe of Italy',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-agrigentum',
    name: 'Agrigentum',
    lat: 37.2903,
    lng: 13.5861,
    mintType: 'greek',
    startYear: -510,
    endYear: -210,
    description: 'Major Greek mint in Sicily',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-gela',
    name: 'Gela',
    lat: 37.0636,
    lng: 14.2528,
    mintType: 'greek',
    startYear: -490,
    endYear: -282,
    description: 'Greek mint in Sicily',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-catana',
    name: 'Catana',
    lat: 37.5017,
    lng: 15.0872,
    mintType: 'greek',
    startYear: -476,
    endYear: -200,
    description: 'Greek mint in Sicily (modern Catania)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-massalia',
    name: 'Massalia',
    lat: 43.2965,
    lng: 5.3698,
    mintType: 'greek',
    startYear: -525,
    endYear: -49,
    description: 'Greek colonial mint in southern Gaul (modern Marseille)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-emporiae',
    name: 'Emporiae',
    lat: 42.1353,
    lng: 3.12,
    mintType: 'greek',
    startYear: -500,
    endYear: -49,
    description: 'Greek colonial mint in Hispania (modern Empúries)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-rhodes',
    name: 'Rhodes',
    lat: 36.4344,
    lng: 28.2176,
    mintType: 'greek',
    startYear: -408,
    endYear: -44,
    description: 'Major Greek mint on the island of Rhodes',
    source: 'Nomisma.org',
  },
  // Additional imperial/late Roman mints
  {
    id: 'mint-camulodunum',
    name: 'Camulodunum',
    lat: 51.8917,
    lng: 0.903,
    mintType: 'imperial',
    startYear: 287,
    endYear: 296,
    description: 'Mint under the Carausian revolt in Britain',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-carthago-nova',
    name: 'Carthago Nova',
    lat: 37.5986,
    lng: -0.9813,
    mintType: 'imperial',
    startYear: -27,
    endYear: 37,
    description: 'Imperial mint in Hispania (modern Cartagena)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-nemausus',
    name: 'Nemausus',
    lat: 43.8367,
    lng: 4.3601,
    mintType: 'imperial',
    startYear: -28,
    endYear: 14,
    description: 'Imperial mint in Gaul (modern Nîmes)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-vienna',
    name: 'Vienna',
    lat: 45.5242,
    lng: 4.8769,
    mintType: 'imperial',
    startYear: -36,
    endYear: 14,
    description: 'Imperial mint in Gaul (modern Vienne)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-colonia-agrippina',
    name: 'Colonia Agrippina',
    lat: 50.9375,
    lng: 6.9603,
    mintType: 'imperial',
    startYear: 260,
    endYear: 274,
    description: 'Mint of the Gallic Empire (modern Cologne)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-carnuntum',
    name: 'Carnuntum',
    lat: 48.1133,
    lng: 16.8594,
    mintType: 'imperial',
    startYear: 260,
    endYear: 268,
    description: 'Temporary imperial mint in Pannonia',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-viminacium-imperial',
    name: 'Viminacium (Imperial)',
    lat: 44.7406,
    lng: 21.2106,
    mintType: 'imperial',
    startYear: 239,
    endYear: 255,
    description: 'Imperial mint in Moesia Superior',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-augusta-traiana',
    name: 'Augusta Traiana',
    lat: 42.4275,
    lng: 25.6258,
    mintType: 'provincial',
    startYear: 98,
    endYear: 217,
    description: 'Provincial mint in Thrace (modern Stara Zagora)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-perinthus',
    name: 'Perinthus',
    lat: 41.0025,
    lng: 27.9542,
    mintType: 'provincial',
    startYear: -200,
    endYear: 268,
    description: 'Provincial mint in Thrace (modern Marmara Ereğlisi)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-istrus',
    name: 'Istrus',
    lat: 44.5467,
    lng: 28.7717,
    mintType: 'provincial',
    startYear: -400,
    endYear: 268,
    description: 'Provincial mint in Moesia Inferior (Histria)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-dionysopolis',
    name: 'Dionysopolis',
    lat: 43.1858,
    lng: 28.5103,
    mintType: 'provincial',
    startYear: 138,
    endYear: 244,
    description: 'Provincial mint on the Black Sea coast',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-odessus',
    name: 'Odessus',
    lat: 43.2141,
    lng: 27.9147,
    mintType: 'provincial',
    startYear: -300,
    endYear: 268,
    description: 'Provincial mint on the Black Sea (modern Varna)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-mesembria',
    name: 'Mesembria',
    lat: 42.6581,
    lng: 27.7361,
    mintType: 'provincial',
    startYear: -400,
    endYear: 268,
    description: 'Provincial mint on the Black Sea (modern Nesebar)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-stobi',
    name: 'Stobi',
    lat: 41.5531,
    lng: 21.9731,
    mintType: 'provincial',
    startYear: 69,
    endYear: 268,
    description: 'Provincial mint in Macedonia',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-pella',
    name: 'Pella',
    lat: 40.7617,
    lng: 22.5217,
    mintType: 'provincial',
    startYear: -168,
    endYear: 268,
    description: 'Provincial mint, former Macedonian capital',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-patrae',
    name: 'Patrae',
    lat: 38.2466,
    lng: 21.7346,
    mintType: 'provincial',
    startYear: -31,
    endYear: 268,
    description: 'Provincial mint in Achaea (modern Patras)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-nicopolis-epirus',
    name: 'Nicopolis (Epirus)',
    lat: 38.965,
    lng: 20.7164,
    mintType: 'provincial',
    startYear: -31,
    endYear: 268,
    description: 'Provincial mint in Epirus, founded by Augustus',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-aegeae',
    name: 'Aegeae',
    lat: 37.0569,
    lng: 35.7903,
    mintType: 'provincial',
    startYear: -164,
    endYear: 268,
    description: 'Provincial mint in Cilicia',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-anazarbus',
    name: 'Anazarbus',
    lat: 37.2574,
    lng: 35.9069,
    mintType: 'provincial',
    startYear: 19,
    endYear: 253,
    description: 'Provincial mint in Cilicia',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-mopsuestia',
    name: 'Mopsuestia',
    lat: 37.1653,
    lng: 35.5997,
    mintType: 'provincial',
    startYear: 68,
    endYear: 253,
    description: 'Provincial mint in Cilicia (modern Misis)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-seleucia-pieria',
    name: 'Seleucia Pieria',
    lat: 36.1167,
    lng: 35.9333,
    mintType: 'provincial',
    startYear: -64,
    endYear: 253,
    description: 'Provincial mint, port of Antioch',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-gabala',
    name: 'Gabala',
    lat: 35.3517,
    lng: 35.8667,
    mintType: 'provincial',
    startYear: 98,
    endYear: 253,
    description: 'Provincial mint in Syria',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-tripolis',
    name: 'Tripolis',
    lat: 34.4367,
    lng: 35.8497,
    mintType: 'provincial',
    startYear: -64,
    endYear: 268,
    description: 'Provincial mint in Phoenicia (modern Tripoli)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-byblus',
    name: 'Byblus',
    lat: 34.1214,
    lng: 35.6481,
    mintType: 'provincial',
    startYear: -333,
    endYear: 268,
    description: 'Provincial mint in Phoenicia (modern Byblos)',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-damascus',
    name: 'Damascus',
    lat: 33.5131,
    lng: 36.2919,
    mintType: 'provincial',
    startYear: -333,
    endYear: 268,
    description: 'Provincial mint in Coele-Syria',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-philippopolis-arabia',
    name: 'Philippopolis (Arabia)',
    lat: 33.0833,
    lng: 36.3833,
    mintType: 'provincial',
    startYear: 244,
    endYear: 249,
    description: 'Provincial mint in Arabia founded by Philip the Arab',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-petra',
    name: 'Petra',
    lat: 30.3285,
    lng: 35.4436,
    mintType: 'provincial',
    startYear: 106,
    endYear: 268,
    description: 'Provincial mint in Arabia Petraea',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-gaza',
    name: 'Gaza',
    lat: 31.5,
    lng: 34.4667,
    mintType: 'provincial',
    startYear: -63,
    endYear: 268,
    description: 'Provincial mint in Palestine',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-ascalon',
    name: 'Ascalon',
    lat: 31.6686,
    lng: 34.5664,
    mintType: 'provincial',
    startYear: -104,
    endYear: 268,
    description: 'Provincial mint in Palestine',
    source: 'Nomisma.org',
  },
  {
    id: 'mint-cyrene',
    name: 'Cyrene',
    lat: 32.8256,
    lng: 21.8572,
    mintType: 'provincial',
    startYear: -74,
    endYear: 268,
    description: 'Provincial mint in Cyrenaica',
    source: 'Nomisma.org',
  },
]

// ── Nomisma ID to curated ID mapping for enrichment ─────────────────────

const NOMISMA_TO_CURATED: Record<string, string> = {
  rome: 'mint-roma',
  lugdunum: 'mint-lugdunum',
  treveri: 'mint-treveri',
  siscia: 'mint-siscia',
  sirmium: 'mint-sirmium',
  thessalonica: 'mint-thessalonica',
  nicomedia: 'mint-nicomedia',
  constantinople: 'mint-constantinople',
  antiocheia_syria: 'mint-antioch',
  alexandreia_egypt: 'mint-alexandria',
  carthage: 'mint-carthage',
  londinium: 'mint-londinium',
  ticinum: 'mint-ticinum',
  aquileia: 'mint-aquileia',
  mediolanum: 'mint-mediolanum',
  cyzicus: 'mint-cyzicus',
  heraclea: 'mint-heraclea',
  arelate: 'mint-arelate',
  ravenna: 'mint-ravenna',
  ambianum: 'mint-ambianum',
  serdica: 'mint-serdica',
  ostia: 'mint-ostia',
  ephesus: 'mint-ephesus',
  pergamum: 'mint-pergamum',
  smyrna: 'mint-smyrna',
  sardis: 'mint-sardis',
  tarsus: 'mint-tarsus',
  athens: 'mint-athens',
  syracuse: 'mint-syracuse',
  camulodunum: 'mint-camulodunum',
  nemausus: 'mint-nemausus',
  carnuntum: 'mint-carnuntum',
}

// ── Roman-relevant mint IDs to try from Nomisma ─────────────────────────

const ROMAN_MINT_IDS = [
  'rome',
  'lugdunum',
  'treveri',
  'siscia',
  'sirmium',
  'thessalonica',
  'nicomedia',
  'constantinople',
  'antiocheia_syria',
  'alexandreia_egypt',
  'carthage',
  'londinium',
  'ticinum',
  'aquileia',
  'mediolanum',
  'cyzicus',
  'heraclea',
  'arelate',
  'ravenna',
  'ambianum',
  'serdica',
  'ostia',
  'ephesus',
  'pergamum',
  'smyrna',
  'sardis',
  'tarsus',
  'athens',
  'syracuse',
  'camulodunum',
  'nemausus',
  'carnuntum',
  'brundisium',
  'capua',
  'tarentum',
  'corinth',
  'byzantium',
  'rhodes',
  'side',
  'caesareia_cappadocia',
  'caesareia_maritima',
  'berytus',
  'tyre',
  'sidon',
  'bostra',
  'edessa',
  'carrhae',
  'narbo',
  'massalia',
  'emporiae',
  'carthago_nova',
  'caesaraugusta',
  'tarraco',
  'emerita',
  'barcino',
  'colonia_patricia',
  'philippopolis',
  'marcianopolis',
  'nicopolis_ad_istrum',
  'viminacium',
  'hadrianopolis',
  'tomis',
  'nicaea',
  'pella',
  'patrae',
  'croton',
  'neapolis',
  'metapontum',
  'thurium',
  'velia',
  'rhegium',
  'agrigentum',
  'gela',
  'catana',
  'damascus',
  'gaza',
  'ascalon',
  'cyrene',
  'petra',
  'seleucia_pieria',
  'laodicea_ad_mare',
  'anazarbus',
  'tarsus_cilicia',
  'aegeae_cilicia',
  'mopsuestia',
  'samosata',
  'zeugma',
  'emesa',
  'tripolis',
  'byblus',
  'aelia_capitolina',
  'stobi',
  'deultum',
  'anchialus',
  'odessus',
  'mesembria',
  'istrus',
  'dionysopolis',
  'pautalia',
  'augusta_trajana',
  'perinthus',
  'philippopolis_arabia',
  'cyrrhus',
  'singara',
  'gabala',
  'neapolis_samaria',
  'nicopolis_epirus',
  'callatis',
  'colonia_agrippina',
  'vienna_gaul',
  'ravenna_com',
  'arelate_com',
]

// ── Main logic ───────────────────────────────────────────────────────────

async function fetchWithDelay(
  mintIds: string[],
  batchSize: number,
  delayMs: number,
): Promise<Map<string, { lat: number; lng: number; definition: string; broader: string }>> {
  const results = new Map<
    string,
    { lat: number; lng: number; definition: string; broader: string }
  >()

  for (let i = 0; i < mintIds.length; i += batchSize) {
    const batch = mintIds.slice(i, i + batchSize)
    const promises = batch.map(async (id) => {
      const data = await fetchMintJsonLd(id)
      if (data) results.set(id, data)
    })
    await Promise.all(promises)

    if (i + batchSize < mintIds.length) {
      await new Promise((r) => setTimeout(r, delayMs))
    }
    const fetched = Math.min(i + batchSize, mintIds.length)
    process.stdout.write(`\r  Fetched ${fetched}/${mintIds.length} mint pages...`)
  }
  console.log()
  return results
}

async function main() {
  console.log('Ingesting Roman coin mint data from Nomisma.org...\n')

  // Step 1: Get mint list from SPARQL
  const mintList = await fetchMintList()
  const nomismaLabels = new Map(mintList.map((m) => [m.id, m.label]))

  // Step 2: Fetch coordinates for Roman-relevant mints
  console.log(`\nFetching JSON-LD for ${ROMAN_MINT_IDS.length} Roman-relevant mints...`)
  const nomismaData = await fetchWithDelay(ROMAN_MINT_IDS, 10, 500)
  console.log(`  Got coordinates for ${nomismaData.size} mints from Nomisma.org\n`)

  // Step 3: Build the mints array, starting from curated data and enriching with Nomisma
  const mintMap = new Map<string, CoinMint>()

  // Add all curated mints
  for (const mint of CURATED_MINTS) {
    mintMap.set(mint.id, { ...mint })
  }

  // Enrich curated mints with Nomisma data where we got coordinates
  let enriched = 0
  let added = 0
  for (const [nomismaId, data] of nomismaData) {
    const curatedId = NOMISMA_TO_CURATED[nomismaId]
    if (curatedId && mintMap.has(curatedId)) {
      // Update coordinates from Nomisma if they differ significantly
      const existing = mintMap.get(curatedId)!
      const latDiff = Math.abs(existing.lat - data.lat)
      const lngDiff = Math.abs(existing.lng - data.lng)
      if (latDiff > 0.01 || lngDiff > 0.01) {
        existing.lat = truncateCoord(data.lat)
        existing.lng = truncateCoord(data.lng)
      }
      if (data.definition && !existing.description) {
        existing.description = data.definition
      }
      enriched++
    } else if (!curatedId) {
      // New mint not in curated set - add if we have a label
      const label = nomismaLabels.get(nomismaId) || nomismaId
      const id = slugify(label)
      if (!mintMap.has(id)) {
        mintMap.set(id, {
          id,
          name: label,
          lat: truncateCoord(data.lat),
          lng: truncateCoord(data.lng),
          mintType: 'unknown',
          startYear: null,
          endYear: null,
          description: data.definition || `Mint at ${label}`,
          source: 'Nomisma.org',
        })
        added++
      }
    }
  }

  console.log(`  Enriched ${enriched} curated mints with Nomisma coordinates`)
  console.log(`  Added ${added} new mints from Nomisma\n`)

  // Convert map to sorted array
  const mints = Array.from(mintMap.values())

  // Sort: imperial first, then provincial, republican, greek, unknown; then by name
  const typeOrder: Record<string, number> = {
    imperial: 0,
    provincial: 1,
    republican: 2,
    greek: 3,
    unknown: 4,
  }
  mints.sort((a, b) => {
    const typeA = typeOrder[a.mintType] ?? 5
    const typeB = typeOrder[b.mintType] ?? 5
    if (typeA !== typeB) return typeA - typeB
    return a.name.localeCompare(b.name)
  })

  // Write output
  const outDir = fileURLToPath(new URL('../src/data', import.meta.url))
  await mkdir(outDir, { recursive: true })
  const outPath = fileURLToPath(new URL('../src/data/coin-mints.json', import.meta.url))
  const json = JSON.stringify(mints, null, 2)
  await writeFile(outPath, json + '\n')

  // Stats
  const byType = mints.reduce(
    (acc, m) => {
      acc[m.mintType] = (acc[m.mintType] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  const withDates = mints.filter((m) => m.startYear !== null).length
  const latRange = {
    min: Math.min(...mints.map((m) => m.lat)),
    max: Math.max(...mints.map((m) => m.lat)),
  }
  const lngRange = {
    min: Math.min(...mints.map((m) => m.lng)),
    max: Math.max(...mints.map((m) => m.lng)),
  }

  console.log('Results:')
  console.log(`  Total mints: ${mints.length}`)
  console.log(`  By type:`)
  for (const [type, count] of Object.entries(byType)) {
    console.log(`    ${type}: ${count}`)
  }
  console.log(`  With date ranges: ${withDates}`)
  console.log(`  Lat range: ${latRange.min.toFixed(2)} to ${latRange.max.toFixed(2)}`)
  console.log(`  Lng range: ${lngRange.min.toFixed(2)} to ${lngRange.max.toFixed(2)}`)
  console.log(`  Output: ${outPath} (${(json.length / 1024).toFixed(0)} KB)`)

  console.log('\nSample mints:')
  for (const type of ['imperial', 'provincial', 'republican', 'greek'] as const) {
    const samples = mints.filter((m) => m.mintType === type).slice(0, 3)
    console.log(`  ${type}:`)
    for (const m of samples) {
      console.log(`    ${m.name} (${m.lat}, ${m.lng}) ${m.startYear ?? '?'}-${m.endYear ?? '?'}`)
    }
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
