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

  // Structured data from Wikidata (populated by enrich-wikidata-structured)
  structured?: StructuredData
  images?: WikidataImage[]
  sourceQuality?: 'academic' | 'sourced' | 'unsourced'

  // Cross-reference data from academic sources (populated by enrich-cross-reference)
  crossRef?: CrossRefEnrichment
}

export interface StructuredData {
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

export interface WikidataImage {
  url: string
  caption: string
  license: string
  width?: number
  height?: number
}

export type WikiLookup = Record<string, WikiEnrichment>

// --- Wikidata structured data ---

export interface WikidataStructuredEntry {
  wikidataId: string
  structured: StructuredData
  images: WikidataImage[]
  describedInSources: Array<{
    title: string
    author?: string
    wikidataId: string
    passage?: string
  }>
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

export type WikidataStructuredLookup = Record<string, WikidataStructuredEntry>

// --- Loaders ---

import { loadJson } from '@/data/loadJson'

export async function loadEntityWiki(): Promise<WikiLookup> {
  return loadJson<WikiLookup>(() => import('./entities-wiki.json'))
}

export async function loadAmphitheaterWiki(): Promise<WikiLookup> {
  return loadJson<WikiLookup>(() => import('./amphitheaters-wiki.json'))
}

export async function loadBuildingWiki(): Promise<WikiLookup> {
  return loadJson<WikiLookup>(() => import('./buildings-wiki.json'))
}

export async function loadBattleWiki(): Promise<WikiLookup> {
  return loadJson<WikiLookup>(() => import('./battles-wiki.json'))
}

export async function loadCitiesWiki(): Promise<WikiLookup> {
  return loadJson<WikiLookup>(() => import('./cities-wiki.json'))
}

export async function loadSettlementWiki(): Promise<WikiLookup> {
  return loadJson<WikiLookup>(() => import('./settlements-wiki.json'))
}

export async function loadEmperorWiki(): Promise<WikiLookup> {
  try {
    return await loadJson<WikiLookup>(() => import('./emperors-wiki.json'))
  } catch {
    return {}
  }
}

export async function loadLegionWiki(): Promise<WikiLookup> {
  try {
    return await loadJson<WikiLookup>(() => import('./legions-wiki.json'))
  } catch {
    return {}
  }
}

export async function loadAqueductWiki(): Promise<WikiLookup> {
  try {
    return await loadJson<WikiLookup>(() => import('./aqueducts-wiki.json'))
  } catch {
    return {}
  }
}

export async function loadPortWiki(): Promise<WikiLookup> {
  try {
    return await loadJson<WikiLookup>(() => import('./ports-wiki.json'))
  } catch {
    return {}
  }
}

export async function loadWikidataStructured(): Promise<WikidataStructuredLookup> {
  try {
    return await loadJson<WikidataStructuredLookup>(() => import('./wikidata-structured.json'))
  } catch {
    return {}
  }
}

// --- Cross-reference data (academic sources) ---

export interface CrossRefEnrichment {
  ancientName?: string
  greekName?: string
  modernName?: string
  province?: string
  provinceSrc?: string
  startYear?: number
  endYear?: number
  pleiadesDescription?: string
  pleiadesType?: string
  /** Ancient text mentions — name-matched only, never spatially attributed */
  ancientTextMentions?: number
  ancientAuthors?: string[]
  tradeRole?: string
  combatants?: string
  commander?: string
  outcome?: string
  capacity?: number
  dimensions?: string
  buildingType?: string
  sources: string[]
}

export type CrossRefLookup = Record<string, CrossRefEnrichment>

export async function loadCrossReference(): Promise<CrossRefLookup> {
  try {
    return await loadJson<CrossRefLookup>(() => import('./cross-reference.json'))
  } catch {
    return {}
  }
}

/** Map layer names to their cross-reference key prefixes */
const LAYER_SINGULAR: Record<string, string> = {
  cities: 'city',
  amphitheaters: 'amphitheater',
  battles: 'battle',
  buildings: 'building',
  settlements: 'settlement',
  entities: 'entity',
  presses: 'press',
}

/**
 * Merge base wiki enrichment with Wikidata structured data and cross-reference data.
 */
export function mergeStructuredData(
  wiki: WikiLookup,
  structured: WikidataStructuredLookup,
  crossRef?: CrossRefLookup,
  layer?: string,
): WikiLookup {
  const merged: WikiLookup = {}
  const prefix = layer ? (LAYER_SINGULAR[layer] ?? layer.replace(/s$/, '')) : ''
  for (const [id, entry] of Object.entries(wiki)) {
    const wd = structured[id]
    // Cross-ref keys are prefixed: "settlement:2", "amphitheater:flavian-amphitheater", etc.
    const cr = crossRef?.[`${prefix}:${id}`] ?? crossRef?.[id]

    merged[id] = {
      ...entry,
      ...(wd
        ? { structured: wd.structured, images: wd.images, sourceQuality: wd.sourceQuality }
        : {}),
      ...(cr ? { crossRef: cr } : {}),
    }
  }
  return merged
}
