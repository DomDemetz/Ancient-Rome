import { create } from 'zustand'
import type { FilterState } from '@/types'

type FilterKey = keyof FilterState

interface FilterStoreState extends FilterState {
  snapshot: FilterState | null
}

interface FilterActions {
  setFilter: <K extends FilterKey>(key: K, value: FilterState[K]) => void
  resetFilters: () => void
  saveSnapshot: () => void
  restoreSnapshot: () => void
}

const DEFAULT_FILTERS: FilterState = {
  entityTypes: [],
  connectionTypes: [],
  regions: [],
  yearRange: [-753, 476],
  searchQuery: '',
}

const initialState: FilterStoreState = {
  ...DEFAULT_FILTERS,
  snapshot: null,
}

export const useFilterStore = create<FilterStoreState & FilterActions>((set, get) => ({
  ...initialState,

  setFilter: (key, value) => set({ [key]: value }),

  resetFilters: () =>
    set({
      entityTypes: [...DEFAULT_FILTERS.entityTypes],
      connectionTypes: [...DEFAULT_FILTERS.connectionTypes],
      regions: [...DEFAULT_FILTERS.regions],
      yearRange: [...DEFAULT_FILTERS.yearRange] as [number, number],
      searchQuery: DEFAULT_FILTERS.searchQuery,
    }),

  saveSnapshot: () => {
    const { entityTypes, connectionTypes, regions, yearRange, searchQuery } = get()
    set({
      snapshot: { entityTypes, connectionTypes, regions, yearRange, searchQuery },
    })
  },

  restoreSnapshot: () => {
    const { snapshot } = get()
    if (snapshot) {
      set({ ...snapshot, snapshot })
    }
  },
}))

export function getInitialFilterState(): FilterStoreState {
  return { ...initialState, snapshot: null }
}
