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

export async function loadBattles(): Promise<Battle[]> {
  const data = await import('./battles.json')
  return data.default as unknown as Battle[]
}
