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
}

import { loadJson } from '@/data/loadJson'

export async function loadAmphitheaters(): Promise<Amphitheater[]> {
  return loadJson<Amphitheater[]>(() => import('./amphitheaters.json'))
}
