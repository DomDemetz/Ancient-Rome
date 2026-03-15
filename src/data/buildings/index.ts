export interface Building {
  id: string
  name: string
  lat: number
  lng: number
  buildingType: string
  constructionYear: number
  builder: string | null
  description: string
  source: string
}

export async function loadBuildings(): Promise<Building[]> {
  const data = await import('./buildings.json')
  return data.default as unknown as Building[]
}
