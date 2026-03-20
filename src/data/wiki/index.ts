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

export async function loadEntityWiki(): Promise<WikiLookup> {
  const data = await import('./entities-wiki.json')
  return data.default as unknown as WikiLookup
}

export async function loadAmphitheaterWiki(): Promise<WikiLookup> {
  const data = await import('./amphitheaters-wiki.json')
  return data.default as unknown as WikiLookup
}

export async function loadBuildingWiki(): Promise<WikiLookup> {
  const data = await import('./buildings-wiki.json')
  return data.default as unknown as WikiLookup
}

export async function loadBattleWiki(): Promise<WikiLookup> {
  const data = await import('./battles-wiki.json')
  return data.default as unknown as WikiLookup
}

export async function loadSettlementWiki(): Promise<WikiLookup> {
  const data = await import('./settlements-wiki.json')
  return data.default as unknown as WikiLookup
}

export async function loadWikidataStructured(): Promise<WikidataStructuredLookup> {
  try {
    const data = await import('./wikidata-structured.json')
    return data.default as unknown as WikidataStructuredLookup
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
    const data = await import('./cross-reference.json')
    return data.default as unknown as CrossRefLookup
  } catch {
    return {}
  }
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
  for (const [id, entry] of Object.entries(wiki)) {
    const wd = structured[id]
    // Cross-ref keys are prefixed: "settlement:2", "amphitheater:flavian-amphitheater", etc.
    const layerSingular = layer?.replace(/s$/, '') ?? ''
    const cr = crossRef?.[`${layerSingular}:${id}`] ?? crossRef?.[id]

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
