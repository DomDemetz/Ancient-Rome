/**
 * The entity atlas — the ONE runtime artifact for point entities, emitted
 * from the canonical entity table by scripts/build-entity-atlas.py.
 * Replaces the three silo loaders (vici chunks, unified datasets, legacy
 * building/amphitheater files) for rendering. Battles, epigraphy, and
 * settlements (place nodes) stay with their special layers; a row whose
 * sources include a place node is excluded at emit, so PlacesLayer and
 * this atlas never draw the same real-world entity twice.
 */
import { loadJsonRaw } from '@/data/loadJson'

export interface AtlasEntity {
  /** entity id — the knowledge-features lookup key */
  i: string
  /** cross-ref detail key when it differs from i */
  d?: string
  /** display name (absent on unnamed survey points) */
  n?: string
  /** kind: fort, temple, villa, shipwreck, ... */
  k: string
  /** subtype where present: circus, amphora cargo, gold, ... */
  st?: string
  la: number
  lo: number
  /** attestation window */
  s?: number
  e?: number
  /** 1 knowledge-bearing · 2 named · 3 unnamed texture */
  t: 1 | 2 | 3
}

export const ATLAS_CATEGORIES = [
  'cities',
  'rural',
  'military',
  'infrastructure',
  'religious',
  'production',
  'funerary',
  'other',
] as const

export type AtlasCategory = (typeof ATLAS_CATEGORIES)[number]

const CHUNKS: Record<AtlasCategory, () => Promise<{ default: string }>> = {
  cities: () => import('./cities.json?raw'),
  rural: () => import('./rural.json?raw'),
  military: () => import('./military.json?raw'),
  infrastructure: () => import('./infrastructure.json?raw'),
  religious: () => import('./religious.json?raw'),
  production: () => import('./production.json?raw'),
  funerary: () => import('./funerary.json?raw'),
  other: () => import('./other.json?raw'),
}

/** Load one category chunk — the dataset-toggle loader. */
export async function loadAtlasCategory(category: string): Promise<AtlasEntity[]> {
  const loader = CHUNKS[category as AtlasCategory]
  if (!loader) throw new Error(`Unknown atlas category: ${category}`)
  return loadJsonRaw<AtlasEntity[]>(loader)
}

/** Load selected categories (defaults to all), in parallel chunks. */
export async function loadAtlasEntities(
  categories?: AtlasCategory[],
): Promise<Map<AtlasCategory, AtlasEntity[]>> {
  const keys = categories ?? [...ATLAS_CATEGORIES]
  const parts = await Promise.all(keys.map((k) => loadJsonRaw<AtlasEntity[]>(CHUNKS[k])))
  return new Map(keys.map((k, idx) => [k, parts[idx]]))
}
