import { create } from 'zustand'

interface UIState {
  detailPanelOpen: boolean
  isMobile: boolean
  // Id of the active guided tour, or null. Mirrored here (not just in
  // useStoryMode's local state) so useURLSync can own the ?story param in its
  // single write path rather than a competing writer racing it.
  activeStoryId: string | null
}

interface UIActions {
  toggleDetail: (open?: boolean) => void
  setMobile: (isMobile: boolean) => void
  setActiveStoryId: (id: string | null) => void
}

const initialState: UIState = {
  detailPanelOpen: false,
  isMobile: false,
  activeStoryId: null,
}

export const useUIStore = create<UIState & UIActions>((set) => ({
  ...initialState,

  toggleDetail: (open) =>
    set((state) => ({
      detailPanelOpen: open !== undefined ? open : !state.detailPanelOpen,
    })),

  setMobile: (isMobile) => set({ isMobile }),

  setActiveStoryId: (id) => set({ activeStoryId: id }),
}))

export function getInitialUIState(): UIState {
  return { ...initialState }
}
