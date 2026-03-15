export interface ReligiousSite {
  id: string
  name: string
  lat: number
  lng: number
  religion: string
  siteType: string
  deity: string | null
  startYear: number
  endYear: number
  description: string
  source: string
}

export async function loadReligion(): Promise<ReligiousSite[]> {
  const data = await import('./religion.json')
  return data.default as unknown as ReligiousSite[]
}
