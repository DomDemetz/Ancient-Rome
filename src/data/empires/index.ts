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

/** Era buckets — keep in sync with scripts/chunk-empires.py. A shape
 *  spanning a boundary lives in every bucket it overlaps; merge with
 *  dedupeEmpires. */
export const EMPIRE_ERAS: Array<[number, number]> = [
  [-3700, -800],
  [-800, 0],
  [0, 500],
  [500, 1000],
  [1000, 1500],
  [1500, 1800],
  [1800, 2025],
]

export function empireEraIndex(year: number): number {
  const i = EMPIRE_ERAS.findIndex(([lo, hi]) => year >= lo && year < hi)
  return i === -1 ? (year < -3700 ? 0 : EMPIRE_ERAS.length - 1) : i
}

const ERA_LOADERS: Array<() => Promise<EmpireShape[]>> = [
  () => loadJsonRaw<EmpireShape[]>(() => import('./era-0.json?raw')),
  () => loadJsonRaw<EmpireShape[]>(() => import('./era-1.json?raw')),
  () => loadJsonRaw<EmpireShape[]>(() => import('./era-2.json?raw')),
  () => loadJsonRaw<EmpireShape[]>(() => import('./era-3.json?raw')),
  () => loadJsonRaw<EmpireShape[]>(() => import('./era-4.json?raw')),
  () => loadJsonRaw<EmpireShape[]>(() => import('./era-5.json?raw')),
  () => loadJsonRaw<EmpireShape[]>(() => import('./era-6.json?raw')),
]

export async function loadEmpiresEra(i: number): Promise<EmpireShape[]> {
  return ERA_LOADERS[Math.max(0, Math.min(ERA_LOADERS.length - 1, i))]()
}

export function dedupeEmpires(...batches: EmpireShape[][]): EmpireShape[] {
  const seen = new Set<string>()
  const out: EmpireShape[] = []
  for (const batch of batches) {
    for (const e of batch) {
      if (seen.has(e.id)) continue
      seen.add(e.id)
      out.push(e)
    }
  }
  return out
}

/** Seshat Databank attributes joined per Cliopatria polity NAME (QIDs are
 *  reused across related polities — Roman & Eastern Roman are both Q12544 —
 *  so name is the join key). Built by scripts/build-seshat-enrichment.py. */
export interface SeshatInfo {
  /** Seshat polity code, e.g. ir_sassanid_emp_1 */
  sid: string
  /** capital name(s), ' · '-joined */
  c?: string
  /** [lat, lng] of the first located capital */
  cl?: [number, number]
  /** general_description prose, citations stripped */
  d?: string
}

export async function loadSeshat(): Promise<Record<string, SeshatInfo>> {
  return loadJsonRaw<Record<string, SeshatInfo>>(() => import('./seshat.json?raw'))
}

/** Full monolith (all eras) — kept for tooling; the map loads eras. */
export async function loadEmpires(): Promise<EmpireShape[]> {
  const all = await Promise.all(ERA_LOADERS.map((l) => l()))
  return dedupeEmpires(...all)
}
