import type { FeatureCollection } from 'geojson'
import type { PresenceGrid } from '@/features/map/PresenceLayer'

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
}

export async function loadRoads(): Promise<FeatureCollection> {
  const data = await import('./roads.json')
  return data.default as unknown as FeatureCollection
}

export async function loadSettlements(): Promise<DareSettlement[]> {
  const data = await import('./settlements.json')
  return data.default as unknown as DareSettlement[]
}

export async function loadLimes(): Promise<FeatureCollection> {
  const data = await import('./limes.json')
  return data.default as unknown as FeatureCollection
}

export async function loadPresenceGrid(): Promise<PresenceGrid> {
  const data = await import('./presence-grid.json')
  return data.default as unknown as PresenceGrid
}

export async function loadProvinces(): Promise<FeatureCollection> {
  const data = await import('./provinces.json')
  return data.default as unknown as FeatureCollection
}

export async function loadFortifications(): Promise<FeatureCollection> {
  const data = await import('./fortifications.json')
  return data.default as unknown as FeatureCollection
}

export async function loadWater(): Promise<FeatureCollection> {
  const data = await import('./water.json')
  return data.default as unknown as FeatureCollection
}

export interface ProvinceLabel {
  name: string
  lat: number
  lng: number
  startYear: number
  endYear: number
}

export async function loadProvinceLabels(): Promise<ProvinceLabel[]> {
  const data = await import('./province-labels.json')
  return data.default as unknown as ProvinceLabel[]
}

export interface CityPopulation {
  name: string
  latinVariants: string[]
  populations: { year: number; population: number }[]
}

export async function loadCityPopulations(): Promise<CityPopulation[]> {
  const data = await import('./city-populations.json')
  return data.default as unknown as CityPopulation[]
}
