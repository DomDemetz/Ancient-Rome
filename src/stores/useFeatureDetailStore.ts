import { create } from 'zustand'

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

  openFeature: (id, layer) => set({ featureId: id, featureLayer: layer }),
  closeFeature: () => set({ featureId: null, featureLayer: null }),
}))
