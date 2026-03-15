export interface Amphitheater {
  id: string
  name: string
  lat: number
  lng: number
  capacity: number | null
  constructionYear: number | null
  dimensions: string | null
  city: string
  source: string
  pleiadesId: string | null
}

export async function loadAmphitheaters(): Promise<Amphitheater[]> {
  const data = await import('./amphitheaters.json')
  return data.default as unknown as Amphitheater[]
}
