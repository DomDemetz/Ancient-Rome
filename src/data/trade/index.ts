export interface TradeNode {
  id: string
  name: string
  lat: number
  lng: number
  siteType: string
  province: string
  modern: string
  territoryYear?: number | null
  declineYear?: number | null
}

export interface TradeRoute {
  id: string
  from: string
  to: string
  transportType: 'road' | 'sea' | 'river'
  distanceKm: number
  coordinates: [number, number][]
  territoryYear?: number | null
  declineYear?: number | null
}

export interface TradeNetwork {
  sites: TradeNode[]
  routes: TradeRoute[]
}

export async function loadTradeNetwork(): Promise<TradeNetwork> {
  const data = await import('./orbis-temporal.json')
  return data.default as unknown as TradeNetwork
}
