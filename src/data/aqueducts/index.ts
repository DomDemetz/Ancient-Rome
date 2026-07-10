export interface Aqueduct {
  /** set by apply-event-caps.py for real destructions (Vesuvius 79) */
  destroyedYear?: number
  id: string
  name: string
  lat: number
  lng: number
  constructionYear: number
  length: number | null
  builder: string | null
  cityServed: string
  description: string
  source: string
}

import { loadJson } from '@/data/loadJson'

export async function loadAqueducts(): Promise<Aqueduct[]> {
  return loadJson<Aqueduct[]>(() => import('./aqueducts.json'))
}
