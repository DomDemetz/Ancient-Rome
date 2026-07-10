export interface Amphitheater {
  id: string
  name: string
  lat: number
  lng: number
  capacity: number | null
  constructionYear: number | null
  dimensions: string | null
  city: string
  source: string
  pleiadesId: string | null
  /** set by apply-event-caps.py for real destructions (Vesuvius 79) */
  destroyedYear?: number
}

import { loadJson } from '@/data/loadJson'

export async function loadAmphitheaters(): Promise<Amphitheater[]> {
  return loadJson<Amphitheater[]>(() => import('./amphitheaters.json'))
}
