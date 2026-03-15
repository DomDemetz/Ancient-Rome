import type { FeatureCollection } from 'geojson'

export async function loadItinereRoads(): Promise<FeatureCollection> {
  const data = await import('./roads.json')
  return data.default as unknown as FeatureCollection
}
