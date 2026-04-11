export interface Emperor {
  id: string
  name: string
  reignStart: number
  reignEnd: number
  born: number | null
  died: number | null
  birthPlace: string | null
  birthLat: number | null
  birthLng: number | null
  dynasty: string | null
  riseType: string
  causeOfDeath: string | null
  description: string
  source: string
}

import { loadJson } from '@/data/loadJson'

export async function loadEmperors(): Promise<Emperor[]> {
  return loadJson<Emperor[]>(() => import('./emperors.json'))
}
