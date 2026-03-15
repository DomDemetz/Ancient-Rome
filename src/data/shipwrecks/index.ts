export interface Shipwreck {
  id: string
  name: string
  lat: number
  lng: number
  startYear: number
  endYear: number
  cargoType: string | null
  depth: number | null
  description: string
  source: string
}

export async function loadShipwrecks(): Promise<Shipwreck[]> {
  const data = await import('./shipwrecks.json')
  return data.default as unknown as Shipwreck[]
}
