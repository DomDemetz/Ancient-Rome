export interface Aqueduct {
  id: string
  name: string
  lat: number
  lng: number
  constructionYear: number
  length: number | null
  builder: string | null
  cityServed: string
  description: string
  source: string
}

export async function loadAqueducts(): Promise<Aqueduct[]> {
  const data = await import('./aqueducts.json')
  return data.default as unknown as Aqueduct[]
}
