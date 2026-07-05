/**
 * Canonical place nodes — THE entity model (see ENTITY-MODEL.md).
 *
 * One node per real-world place, merged at build time from DARE settlements,
 * Chandler city-population curves, Pleiades identity/coords and Wikidata QIDs
 * via the registry crosswalks. Built by scripts/build-entities.py.
 */
export interface PlacePopulationPoint {
  year: number
  population: number
}

export interface PlaceNode {
  id: string // canonical: "pl-<pleiadesId>" | "dare-<id>" | "ch-<id>"
  name: string
  lat: number
  lng: number
  startYear: number // 0 = unknown (DARE semantics)
  endYear: number // 0 = unknown
  pid?: string // Pleiades ID
  qid?: string // Wikidata QID
  modern?: string
  /** which enrichment file knows this place: [layer, key] */
  wiki?: [string, string]
  /** gazetteer-only node (Pleiades, no DARE/population data): subtle, high-zoom */
  minor?: boolean
  /** attached Vici.org archaeological sites (native pmetadata identity) */
  vici?: string[]
  dare?: {
    id: string
    type?: number
    major: boolean
    territoryYear?: number
    declineYear?: number
  }
  populations?: PlacePopulationPoint[]
}

/** Linear-interpolate a place's population at `year` from its sampled curve. */
export function populationAt(points: PlacePopulationPoint[], year: number): number | null {
  if (points.length === 0) return null
  if (year <= points[0].year) return points[0].population
  if (year >= points[points.length - 1].year) return points[points.length - 1].population
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (year >= a.year && year <= b.year) {
      const span = b.year - a.year
      if (span === 0) return a.population
      const t = (year - a.year) / span
      return Math.round(a.population + t * (b.population - a.population))
    }
  }
  return null
}

import { loadJson } from '@/data/loadJson'

export async function loadPlaces(): Promise<PlaceNode[]> {
  return loadJson<PlaceNode[]>(() => import('./places.json'))
}
