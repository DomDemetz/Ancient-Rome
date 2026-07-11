import { create } from 'zustand'
import { useSelectionStore } from './useSelectionStore'

export interface FeatureFallback {
  title?: string
  kind?: string
  dates?: string
}

interface FeatureDetailState {
  featureId: string | null
  featureLayer: string | null
  /** absorbed narrative-graph entity for this feature, if any */
  featureEntityId: string | null
  /** minimal record carried from the popup — the panel renders this when
   *  no knowledge entry exists (every dot deserves a panel) */
  featureFallback: FeatureFallback | null
}

interface FeatureDetailActions {
  openFeature: (id: string, layer: string, entityId?: string, fallback?: FeatureFallback) => void
  closeFeature: () => void
}

export const useFeatureDetailStore = create<FeatureDetailState & FeatureDetailActions>((set) => ({
  featureId: null,
  featureLayer: null,
  featureEntityId: null,
  featureFallback: null,

  openFeature: (id, layer, entityId, fallback) => {
    // Close entity detail panel synchronously to prevent dual-render flash
    useSelectionStore.getState().select(null)
    set({
      featureId: id,
      featureLayer: layer,
      featureEntityId: entityId ?? null,
      featureFallback: fallback ?? null,
    })
  },
  closeFeature: () =>
    set({ featureId: null, featureLayer: null, featureEntityId: null, featureFallback: null }),
}))
