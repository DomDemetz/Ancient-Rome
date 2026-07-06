/**
 * World polities from Cliopatria (Seshat Global History Databank, CC BY 4.0)
 * — every state on earth overlapping the atlas window, each shape valid for
 * [from, to] and carrying its Wikidata QID. The Roman states are excluded
 * (the curated territory layer remains authoritative for Rome/Byzantium).
 * Built by scripts/ingest-cliopatria.py.
 */
export interface EmpireShape {
  id: string
  name: string
  from: number
  to: number
  qid?: string
  /** Wikipedia article title */
  wp?: string
  memberOf?: string
  /** km² (Cliopatria's own figure) */
  area: number
  /** label anchor [lat, lng] — centroid of the largest polygon */
  label: [number, number]
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: unknown[]
  }
}

import { loadJsonRaw } from '@/data/loadJson'

export async function loadEmpires(): Promise<EmpireShape[]> {
  return loadJsonRaw<EmpireShape[]>(() => import('./empires.json?raw'))
}
