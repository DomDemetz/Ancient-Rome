export interface Mine {
  id: string
  name: string
  lat: number
  lng: number
  resourceType: string
  siteType: 'mine' | 'quarry'
  startYear: number
  endYear: number
  description: string
  source: string
}

import { loadJson } from '@/data/loadJson'

export async function loadMines(): Promise<Mine[]> {
  return loadJson<Mine[]>(() => import('./mines.json'))
}
