import type { FeatureCollection } from 'geojson'
import { loadJson } from '@/data/loadJson'

export async function loadDarmcRoads(): Promise<FeatureCollection> {
  return loadJson<FeatureCollection>(() => import('./roads.json'))
}
