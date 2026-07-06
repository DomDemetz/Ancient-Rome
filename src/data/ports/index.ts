export interface AncientPort {
  id: string
  name: string
  lat: number
  lng: number
  portType: string
  description: string
  startYear: number
  endYear: number
}

import { loadJson } from '@/data/loadJson'

export async function loadPorts(): Promise<AncientPort[]> {
  return loadJson<AncientPort[]>(() => import('../ancient-ports.json'))
}
