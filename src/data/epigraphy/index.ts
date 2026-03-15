export interface EpigraphyCluster {
  id: string
  lat: number
  lng: number
  count: number
  province: string
  startYear: number
  endYear: number
}

export async function loadEpigraphy(): Promise<EpigraphyCluster[]> {
  const data = await import('./epigraphy.json')
  return data.default as unknown as EpigraphyCluster[]
}
