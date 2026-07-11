import type { FeatureCollection } from 'geojson'
import type { PresenceGrid } from '@/features/map/layers/PresenceLayer'
import { loadJson } from '@/data/loadJson'

export interface DareSettlement {
  id: string
  name: string
  modern: string
  greek?: string
  lat: number
  lng: number
  major: boolean
  type: number
  startYear: number
  endYear: number
  territoryYear?: number | null
  declineYear?: number | null
}

export async function loadRoads(): Promise<FeatureCollection> {
  return loadJson<FeatureCollection>(() => import('./roads-temporal.json'))
}

export async function loadSettlements(): Promise<DareSettlement[]> {
  return loadJson<DareSettlement[]>(() => import('./settlements.json'))
}

export async function loadLimes(): Promise<FeatureCollection> {
  return loadJson<FeatureCollection>(() => import('./limes.json'))
}

/** DARMC Islamic conquest phases 622-750 (CC BY-NC-SA 4.0) — five waves,
 *  each visible from its startYear. Built by scripts/ingest-islamic-conquests.py. */
export async function loadIslamicConquests(): Promise<FeatureCollection> {
  return loadJson<FeatureCollection>(() => import('./islamic-conquests.json'))
}

export async function loadPresenceGrid(): Promise<PresenceGrid> {
  return loadJson<PresenceGrid>(() => import('./presence-grid.json'))
}

export async function loadProvinces(): Promise<FeatureCollection> {
  return loadJson<FeatureCollection>(() => import('./provinces.json'))
}

export async function loadFortifications(): Promise<FeatureCollection> {
  return loadJson<FeatureCollection>(() => import('./fortifications-temporal.json'))
}

export async function loadWater(): Promise<FeatureCollection> {
  return loadJson<FeatureCollection>(() => import('./water.json'))
}

export interface ProvinceLabel {
  name: string
  lat: number
  lng: number
  startYear: number
  endYear: number
}

export async function loadProvinceLabels(): Promise<ProvinceLabel[]> {
  return loadJson<ProvinceLabel[]>(() => import('./province-labels.json'))
}

export interface CityPopulation {
  name: string
  latinVariants: string[]
  populations: { year: number; population: number }[]
}

export async function loadCityPopulations(): Promise<CityPopulation[]> {
  return loadJson<CityPopulation[]>(() => import('./city-populations.json'))
}

export interface ProvinceChange {
  originalName: string
  splitYear: number
  newProvinces: { name: string; labelLat: number; labelLng: number }[]
}

export async function loadProvinceChanges(): Promise<ProvinceChange[]> {
  return loadJson<ProvinceChange[]>(() => import('./province-changes.json'))
}
