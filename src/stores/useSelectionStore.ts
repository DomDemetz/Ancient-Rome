import { create } from 'zustand'

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

  select: (id) =>
    set((state) => {
      const newBreadcrumbs =
        id !== null ? [...state.breadcrumbs, id].slice(-MAX_BREADCRUMBS) : state.breadcrumbs
      return { selectedId: id, breadcrumbs: newBreadcrumbs }
    }),

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
