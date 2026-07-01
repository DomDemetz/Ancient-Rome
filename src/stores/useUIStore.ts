import { create } from 'zustand'

export type Lens = 'graph' | 'map' | 'timeline' | 'stats'

interface UIState {
  lens: Lens
  atlasMode: boolean
  detailPanelOpen: boolean
  sidebarOpen: boolean
  isMobile: boolean
  // Id of the active guided tour, or null. Mirrored here (not just in
  // useStoryMode's local state) so useURLSync can own the ?story param in its
  // single write path rather than a competing writer racing it.
  activeStoryId: string | null
}

interface UIActions {
  switchLens: (lens: Lens) => void
  toggleDetail: (open?: boolean) => void
  toggleSidebar: (open?: boolean) => void
  setMobile: (isMobile: boolean) => void
  setActiveStoryId: (id: string | null) => void
}

const initialState: UIState = {
  lens: 'map',
  atlasMode: true,
  detailPanelOpen: false,
  sidebarOpen: true,
  isMobile: false,
  activeStoryId: null,
}

export const useUIStore = create<UIState & UIActions>((set, get) => ({
  ...initialState,

  switchLens: (lens) => {
    if (get().atlasMode) return
    set({ lens })
  },

  toggleDetail: (open) =>
    set((state) => ({
      detailPanelOpen: open !== undefined ? open : !state.detailPanelOpen,
    })),

  toggleSidebar: (open) =>
    set((state) => ({
      sidebarOpen: open !== undefined ? open : !state.sidebarOpen,
    })),

  setMobile: (isMobile) => set({ isMobile }),

  setActiveStoryId: (id) => set({ activeStoryId: id }),
}))

export function getInitialUIState(): UIState {
  return { ...initialState }
}
