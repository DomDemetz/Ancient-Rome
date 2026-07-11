import { useMemo } from 'react'
import { useWikiEnrichment } from '@/hooks/useWikiEnrichment'
import type { WikiLookup } from '@/data/wiki'

/**
 * ONE knowledge lookup for entities (standardization pass, 2026-07-11).
 *
 * Knowledge ships in two tiered stores for good reasons (places core paints
 * before minor streams; features stay slim until the panel opens) — but
 * consumers must not know that. This facade resolves an entity by its id
 * and optional detail key across both stores and says which panel layer
 * owns the result. It replaces per-consumer branching on key shape
 * (the old `isNode` regex in AtlasLayer).
 */

const NODE_KEY = /^(dare|pl|wd)-/

export interface KnowledgeHit {
  entry: WikiLookup[string] | undefined
  /** data-wiki-layer value the detail panel expects for this entry */
  layerName: 'knowledge-features' | 'knowledge-places'
  /** the key the entry was found under (feed to popups/panel as data-wiki-id) */
  key: string
}

export function useEntityKnowledge() {
  const features = useWikiEnrichment('knowledge-features')
  const places = useWikiEnrichment('knowledge-places')

  return useMemo(
    () => ({
      /** id = entity id; detailKey = adjudicated fallback (may be a node id) */
      resolve(id: string, detailKey?: string): KnowledgeHit {
        const isNode = !!detailKey && NODE_KEY.test(detailKey)
        if (isNode) {
          const key = detailKey!
          return { entry: places?.[key], layerName: 'knowledge-places', key }
        }
        if (features?.[id]) {
          return { entry: features[id], layerName: 'knowledge-features', key: id }
        }
        const key = detailKey ?? id
        return { entry: features?.[key], layerName: 'knowledge-features', key }
      },
    }),
    [features, places],
  )
}
