import { create } from 'zustand'
import { useSelectionStore } from './useSelectionStore'

interface FeatureDetailState {
  featureId: string | null
  featureLayer: string | null
}

interface FeatureDetailActions {
  openFeature: (id: string, layer: string) => void
  closeFeature: () => void
}

export const useFeatureDetailStore = create<FeatureDetailState & FeatureDetailActions>((set) => ({
  featureId: null,
  featureLayer: null,

  openFeature: (id, layer) => {
    // Close entity detail panel synchronously to prevent dual-render flash
    useSelectionStore.getState().select(null)
    set({ featureId: id, featureLayer: layer })
  },
  closeFeature: () => set({ featureId: null, featureLayer: null }),
}))
