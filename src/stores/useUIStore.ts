import { create } from 'zustand'

export type Lens = 'graph' | 'map' | 'timeline' | 'stats'

interface UIState {
  lens: Lens
  atlasMode: boolean
  detailPanelOpen: boolean
  sidebarOpen: boolean
  isMobile: boolean
}

interface UIActions {
  switchLens: (lens: Lens) => void
  toggleDetail: (open?: boolean) => void
  toggleSidebar: (open?: boolean) => void
  setMobile: (isMobile: boolean) => void
}

const initialState: UIState = {
  lens: 'map',
  atlasMode: true,
  detailPanelOpen: false,
  sidebarOpen: true,
  isMobile: false,
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
}))

export function getInitialUIState(): UIState {
  return { ...initialState }
}
