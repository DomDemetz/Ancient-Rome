export interface PleiadesPlace {
  id: string
  name: string
  lat: number
  lng: number
  placeType: string
  startYear: number
  endYear: number
  description: string
  source: string
}

export async function loadPleiadesAll(): Promise<PleiadesPlace[]> {
  const data = await import('../pleiades-all.json')
  return data.default as unknown as PleiadesPlace[]
}
