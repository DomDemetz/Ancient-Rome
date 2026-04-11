export interface ReligiousSite {
  id: string
  name: string
  lat: number
  lng: number
  religion: string
  siteType: string
  deity: string | null
  startYear: number
  endYear: number
  description: string
  source: string
}

import { loadJson } from '@/data/loadJson'

export async function loadReligion(): Promise<ReligiousSite[]> {
  return loadJson<ReligiousSite[]>(() => import('./religion.json'))
}
