export interface LegionBase {
  location: string
  lat: number
  lng: number
  fromYear: number
  toYear: number
}

export interface Legion {
  id: string
  name: string
  number: string
  cognomen: string
  symbol: string | null
  founded: number
  dissolved: number | null
  status: 'active' | 'destroyed' | 'merged' | 'unknown'
  bases: LegionBase[]
  description: string
  source: string
}

import { loadJson } from '@/data/loadJson'

export async function loadLegions(): Promise<Legion[]> {
  return loadJson<Legion[]>(() => import('./legions.json'))
}
