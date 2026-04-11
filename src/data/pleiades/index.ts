export interface PleiadesPlace {
  id: string
  name: string
  lat: number
  lng: number
  placeType: string
  startYear: number
  endYear: number
  description: string
  source: string
}

import { loadJson } from '@/data/loadJson'

export async function loadPleiadesAll(): Promise<PleiadesPlace[]> {
  return loadJson<PleiadesPlace[]>(() => import('../pleiades-all.json'))
}
