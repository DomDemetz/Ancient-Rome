import type { FeatureCollection } from 'geojson'

export async function loadDarmcRoads(): Promise<FeatureCollection> {
  const data = await import('./roads.json')
  return data.default as unknown as FeatureCollection
}
