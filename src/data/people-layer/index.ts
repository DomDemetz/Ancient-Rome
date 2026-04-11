export interface NotablePerson {
  id: string
  name: string
  born: number
  died: number | null
  gender: string
  role: string
  domain: string
  citizenship: string
  birthLat: number
  birthLng: number
  deathLat: number | null
  deathLng: number | null
  notability: number
  wikidataId: string
}

import { loadJson } from '@/data/loadJson'

export async function loadNotablePeople(): Promise<NotablePerson[]> {
  return loadJson<NotablePerson[]>(() => import('./notable-people.json'))
}
