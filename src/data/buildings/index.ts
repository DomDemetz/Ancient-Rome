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
  /** set by apply-event-caps.py for real destructions (Vesuvius 79) —
   *  unlike attestedTo, which only marks where the source's period ends */
  destroyedYear?: number
}

import { loadJson } from '@/data/loadJson'

export async function loadBuildings(): Promise<Building[]> {
  return loadJson<Building[]>(() => import('./buildings.json'))
}
