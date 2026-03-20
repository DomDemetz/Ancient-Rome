import { create } from 'zustand'
import { useFeatureDetailStore } from './useFeatureDetailStore'

const MAX_BREADCRUMBS = 50

interface SelectionState {
  selectedId: string | null
  hoveredId: string | null
  breadcrumbs: string[]
  pinnedIds: string[]
}

interface SelectionActions {
  select: (id: string | null) => void
  hover: (id: string | null) => void
  pin: (id: string) => void
  unpin: (id: string) => void
  clearTrail: () => void
}

const initialState: SelectionState = {
  selectedId: null,
  hoveredId: null,
  breadcrumbs: [],
  pinnedIds: [],
}

export const useSelectionStore = create<SelectionState & SelectionActions>((set) => ({
  ...initialState,

  select: (id) => {
    // Close wiki detail panel synchronously to prevent dual-render flash.
    // Import is at top of file — no circular issue since both stores
    // only reference each other inside action functions, not at init.
    if (id !== null) {
      useFeatureDetailStore.getState().closeFeature()
    }
    set((state) => {
      const newBreadcrumbs =
        id !== null ? [...state.breadcrumbs, id].slice(-MAX_BREADCRUMBS) : state.breadcrumbs
      return { selectedId: id, breadcrumbs: newBreadcrumbs }
    })
  },

  hover: (id) => set({ hoveredId: id }),

  pin: (id) =>
    set((state) => ({
      pinnedIds: state.pinnedIds.includes(id) ? state.pinnedIds : [...state.pinnedIds, id],
    })),

  unpin: (id) =>
    set((state) => ({
      pinnedIds: state.pinnedIds.filter((p) => p !== id),
    })),

  clearTrail: () => set({ breadcrumbs: [] }),
}))

export function getInitialSelectionState(): SelectionState {
  return { ...initialState }
}
