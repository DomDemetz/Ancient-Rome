import { create } from 'zustand'
import { useSelectionStore } from './useSelectionStore'

interface FeatureDetailState {
  featureId: string | null
  featureLayer: string | null
  /** absorbed narrative-graph entity for this feature, if any */
  featureEntityId: string | null
}

interface FeatureDetailActions {
  openFeature: (id: string, layer: string, entityId?: string) => void
  closeFeature: () => void
}

export const useFeatureDetailStore = create<FeatureDetailState & FeatureDetailActions>((set) => ({
  featureId: null,
  featureLayer: null,
  featureEntityId: null,

  openFeature: (id, layer, entityId) => {
    // Close entity detail panel synchronously to prevent dual-render flash
    useSelectionStore.getState().select(null)
    set({ featureId: id, featureLayer: layer, featureEntityId: entityId ?? null })
  },
  closeFeature: () => set({ featureId: null, featureLayer: null, featureEntityId: null }),
}))
