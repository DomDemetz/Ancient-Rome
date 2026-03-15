export interface Mine {
  id: string
  name: string
  lat: number
  lng: number
  resourceType: string
  siteType: 'mine' | 'quarry'
  startYear: number
  endYear: number
  description: string
  source: string
}

export async function loadMines(): Promise<Mine[]> {
  const data = await import('./mines.json')
  return data.default as unknown as Mine[]
}
