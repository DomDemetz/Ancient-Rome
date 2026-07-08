import { useEffect, useSyncExternalStore } from 'react'
import type { WikiLookup, WikidataStructuredLookup, CrossRefLookup } from '@/data/wiki'

const cache = new Map<string, WikiLookup>()
const listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function notify() {
  for (const cb of listeners) cb()
}

// Shared singleton caches — loaded once, used by all layers
let structuredCache: WikidataStructuredLookup | null = null
let crossRefCache: CrossRefLookup | null = null
let structuredLoading = false
let crossRefLoading = false

/** Poll for a cache value with a 10s timeout, returning fallback on expiry */
function waitForCache<T>(getCached: () => T | null, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const deadline = Date.now() + 10_000
    const check = () => {
      const val = getCached()
      if (val) resolve(val)
      else if (Date.now() >= deadline) resolve(fallback)
      else setTimeout(check, 50)
    }
    check()
  })
}

async function ensureStructuredLoaded(): Promise<WikidataStructuredLookup> {
  if (structuredCache) return structuredCache
  if (structuredLoading) return waitForCache(() => structuredCache, {})
  structuredLoading = true
  try {
    const { loadWikidataStructured } = await import('@/data/wiki')
    structuredCache = await loadWikidataStructured()
  } catch {
    structuredCache = {}
  }
  structuredLoading = false
  return structuredCache
}

async function ensureCrossRefLoaded(): Promise<CrossRefLookup> {
  if (crossRefCache) return crossRefCache
  if (crossRefLoading) return waitForCache(() => crossRefCache, {})
  crossRefLoading = true
  try {
    const { loadCrossReference } = await import('@/data/wiki')
    crossRefCache = await loadCrossReference()
  } catch {
    crossRefCache = {}
  }
  crossRefLoading = false
  return crossRefCache
}

function makeLayerLoader(
  loadWiki: () => Promise<WikiLookup>,
  layer: string,
): () => Promise<WikiLookup> {
  return async () => {
    const { mergeStructuredData } = await import('@/data/wiki')
    const [wiki, structured, crossRef] = await Promise.all([
      loadWiki(),
      ensureStructuredLoaded(),
      ensureCrossRefLoaded(),
    ])
    return mergeStructuredData(wiki, structured, crossRef, layer)
  }
}

const LAYER_LOADERS: Record<string, () => Promise<WikiLookup>> = {
  amphitheaters: makeLayerLoader(
    async () => (await import('@/data/wiki')).loadAmphitheaterWiki(),
    'amphitheaters',
  ),
  battles: makeLayerLoader(async () => (await import('@/data/wiki')).loadBattleWiki(), 'battles'),
  // graph-keyed consolidated knowledge: crossRef ships inline, no merge pass
  'knowledge-places': async () => (await import('@/data/wiki')).loadKnowledgePlaces(),
  'knowledge-places-detail': async () => (await import('@/data/wiki')).loadKnowledgePlacesDetail(),
  'knowledge-features': async () => (await import('@/data/wiki')).loadKnowledgeFeatures(),
  cities: makeLayerLoader(
    async () => (await import('@/data/wiki')).loadSettlementWiki(),
    'settlements',
  ),
  settlements: makeLayerLoader(
    async () => (await import('@/data/wiki')).loadSettlementWiki(),
    'settlements',
  ),
  buildings: makeLayerLoader(
    async () => (await import('@/data/wiki')).loadBuildingWiki(),
    'buildings',
  ),
  entities: makeLayerLoader(async () => (await import('@/data/wiki')).loadEntityWiki(), 'entities'),
  emperors: makeLayerLoader(
    async () => (await import('@/data/wiki')).loadEmperorWiki(),
    'emperors',
  ),
  legions: makeLayerLoader(async () => (await import('@/data/wiki')).loadLegionWiki(), 'legions'),
  aqueducts: makeLayerLoader(
    async () => (await import('@/data/wiki')).loadAqueductWiki(),
    'aqueducts',
  ),
  ports: makeLayerLoader(async () => (await import('@/data/wiki')).loadPortWiki(), 'ports'),
}

const loading = new Set<string>()
const failed = new Set<string>()

export function useCrossRef(): CrossRefLookup | null {
  const snapshot = useSyncExternalStore(subscribe, () => crossRefCache)

  useEffect(() => {
    if (crossRefCache || crossRefLoading) return
    ensureCrossRefLoaded().then(notify)
  }, [])

  return snapshot
}

export function isCrossRefLoading(): boolean {
  return crossRefLoading && !crossRefCache
}

export function useWikiEnrichment(layer: string | null): WikiLookup | null {
  const lookup = useSyncExternalStore(subscribe, () => (layer ? (cache.get(layer) ?? null) : null))

  useEffect(() => {
    if (!layer) return
    if (cache.has(layer) || loading.has(layer) || failed.has(layer)) return

    const loader = LAYER_LOADERS[layer]
    if (!loader) return

    loading.add(layer)
    loader()
      .then((data) => {
        cache.set(layer, data)
        notify()
      })
      .catch(() => {
        // Wiki data is optional — mark as failed to prevent infinite retries
        failed.add(layer)
      })
      .finally(() => loading.delete(layer))
  }, [layer])

  return lookup
}
