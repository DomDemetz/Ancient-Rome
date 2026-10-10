import { create } from 'zustand'

interface UIState {
  detailPanelOpen: boolean
  isMobile: boolean
  // Id of the active guided tour, or null. Mirrored here (not just in
  // useStoryMode's local state) so useURLSync can own the ?story param in its
  // single write path rather than a competing writer racing it.
  activeStoryId: string | null
  // Measurement aids. They live here, not in the layer store: presets and
  // story steps rewrite the layer set, and a classroom's grid must survive that.
  showGraticule: boolean
  showScaleBar: boolean
  rulerActive: boolean
}

interface UIActions {
  toggleDetail: (open?: boolean) => void
  setMobile: (isMobile: boolean) => void
  setActiveStoryId: (id: string | null) => void
  toggleGraticule: () => void
  toggleScaleBar: () => void
  toggleRuler: () => void
}

const initialState: UIState = {
  detailPanelOpen: false,
  isMobile: false,
  activeStoryId: null,
  showGraticule: false,
  showScaleBar: false,
  rulerActive: false,
}

export const useUIStore = create<UIState & UIActions>((set) => ({
  ...initialState,

  toggleDetail: (open) =>
    set((state) => ({
      detailPanelOpen: open !== undefined ? open : !state.detailPanelOpen,
    })),

  setMobile: (isMobile) => set({ isMobile }),

  setActiveStoryId: (id) => set({ activeStoryId: id }),

  toggleGraticule: () => set((state) => ({ showGraticule: !state.showGraticule })),

  toggleScaleBar: () => set((state) => ({ showScaleBar: !state.showScaleBar })),

  toggleRuler: () => set((state) => ({ rulerActive: !state.rulerActive })),
}))

export function getInitialUIState(): UIState {
  return { ...initialState }
}
