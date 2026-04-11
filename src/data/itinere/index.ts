import type { FeatureCollection } from 'geojson'
import { loadJson } from '@/data/loadJson'

export async function loadItinereRoads(): Promise<FeatureCollection> {
  return loadJson<FeatureCollection>(() => import('./roads-temporal.json'))
}
