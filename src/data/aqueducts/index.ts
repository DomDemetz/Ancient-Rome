export interface Aqueduct {
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
