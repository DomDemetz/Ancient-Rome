/**
 * Vici.org archaeological sites (CC BY-SA), chunked per siteType by
 * scripts/chunk-vici.py — replaces the 16 MB vici-sites.json monolith.
 * The 3,378 settlement-kind points represented by canonical place nodes
 * are already excluded at build time (the node draws the city), so the
 * ViciLayer MERGED suppression becomes a no-op with this loader.
 */
import { loadJsonRaw } from '@/data/loadJson'

export interface ViciSiteRecord {
  id: string
  name: string
  lat: number
  lng: number
  siteType: string
  startYear: number
  endYear: number
  territoryYear?: number | null
  declineYear?: number | null
  description?: string
}

const CHUNKS = {
  aqueduct: () => import('./aqueduct.json?raw'),
  bath: () => import('./bath.json?raw'),
  bridge: () => import('./bridge.json?raw'),
  cemetery: () => import('./cemetery.json?raw'),
  fort: () => import('./fort.json?raw'),
  mine: () => import('./mine.json?raw'),
  other: () => import('./other.json?raw'),
  road: () => import('./road.json?raw'),
  settlement: () => import('./settlement.json?raw'),
  temple: () => import('./temple.json?raw'),
  theater: () => import('./theater.json?raw'),
  villa: () => import('./villa.json?raw'),
} as const

export type ViciSiteType = keyof typeof CHUNKS

/** Load selected site types (defaults to all), in parallel chunks. */
export async function loadViciSites(types?: ViciSiteType[]): Promise<ViciSiteRecord[]> {
  const keys = types ?? (Object.keys(CHUNKS) as ViciSiteType[])
  const parts = await Promise.all(
    keys.map((k) => loadJsonRaw<ViciSiteRecord[]>(CHUNKS[k])),
  )
  return parts.flat()
}
