export interface Shipwreck {
  id: string
  name: string
  lat: number
  lng: number
  startYear: number
  endYear: number
  cargoType: string | null
  depth: number | null
  description: string
  source: string
}

import { loadJson } from '@/data/loadJson'

export async function loadShipwrecks(): Promise<Shipwreck[]> {
  return loadJson<Shipwreck[]>(() => import('./shipwrecks.json'))
}
