export interface Building {
  id: string
  name: string
  lat: number
  lng: number
  buildingType: string
  constructionYear: number
  builder: string | null
  description: string
  source: string
}

import { loadJson } from '@/data/loadJson'

export async function loadBuildings(): Promise<Building[]> {
  return loadJson<Building[]>(() => import('./buildings.json'))
}
