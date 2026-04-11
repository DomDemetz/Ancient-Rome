export interface Press {
  id: string
  name: string
  lat: number
  lng: number
  pressType: 'oil' | 'wine'
  startYear: number
  endYear: number
  description: string
  source: string
}

import { loadJson } from '@/data/loadJson'

export async function loadPresses(): Promise<Press[]> {
  return loadJson<Press[]>(() => import('./presses.json'))
}
