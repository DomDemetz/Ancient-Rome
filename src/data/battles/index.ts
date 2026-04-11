export interface Battle {
  id: string
  name: string
  year: number
  lat: number
  lng: number
  outcome: 'victory' | 'defeat' | 'draw' | 'unknown'
  combatants: string
  commander: string
  description: string
  source: string
}

import { loadJson } from '@/data/loadJson'

export async function loadBattles(): Promise<Battle[]> {
  return loadJson<Battle[]>(() => import('./battles.json'))
}
