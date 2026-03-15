import { create } from 'zustand'

interface MapNavState {
  pendingFlyTo: { lat: number; lng: number; zoom?: number } | null
  flyTo: (lat: number, lng: number, zoom?: number) => void
  clearFlyTo: () => void
}

export const useMapNavStore = create<MapNavState>((set) => ({
  pendingFlyTo: null,
  flyTo: (lat, lng, zoom) => set({ pendingFlyTo: { lat, lng, zoom } }),
  clearFlyTo: () => set({ pendingFlyTo: null }),
}))
