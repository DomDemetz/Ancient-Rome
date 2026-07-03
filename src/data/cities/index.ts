export interface CityPopulationPoint {
  year: number
  population: number
}

export interface HistoricalCity {
  id: string
  name: string
  lat: number
  lng: number
  country: string
  startYear: number
  endYear: number
  peakPopulation: number
  populations: CityPopulationPoint[]
  source: string
}

import { loadJson } from '@/data/loadJson'

export async function loadHistoricalCities(): Promise<HistoricalCity[]> {
  return loadJson<HistoricalCity[]>(() => import('./historical-cities.json'))
}
