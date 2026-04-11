export interface EpigraphyCluster {
  id: string
  lat: number
  lng: number
  count: number
  province: string
  startYear: number
  endYear: number
}

import { loadJson } from '@/data/loadJson'

export async function loadEpigraphy(): Promise<EpigraphyCluster[]> {
  return loadJson<EpigraphyCluster[]>(() => import('./epigraphy.json'))
}
