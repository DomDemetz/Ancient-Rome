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
  /** joined ORBIS trade-network site: this place is a node in the network */
  orbis?: { id: string; type: string }
  /** nearest major city: [name, km, compass] — "42 km NE of Londinium" */
  near?: [string, number, string]
  /** absorbed narrative-graph entity (the curated connections graph) */
  entity?: string
  entityConnections?: number
  dare?: {
    id: string
    type?: number
    major: boolean
    territoryYear?: number
    declineYear?: number
  }
  populations?: PlacePopulationPoint[]
}

import { loadJsonRaw } from '@/data/loadJson'

/** Core tier: everything renderable at empire zooms (~1,700 nodes, 0.5 MB).
 *  Mirror of scripts/build-entities.py tier split; keep in sync. */
export async function loadPlacesCore(): Promise<PlaceNode[]> {
  return loadJsonRaw<PlaceNode[]>(() => import('./places-core.json?raw'))
}

/** Detail tier: minors/gazetteer, first renderable at zoom 7-8 (5.6 MB). */
export async function loadPlacesDetail(): Promise<PlaceNode[]> {
  return loadJsonRaw<PlaceNode[]>(() => import('./places-detail.json?raw'))
}

/** Progressive helper: core + detail merged (call sites that need it all). */
export async function loadPlaces(): Promise<PlaceNode[]> {
  const [core, detail] = await Promise.all([loadPlacesCore(), loadPlacesDetail()])
  return [...core, ...detail]
}
