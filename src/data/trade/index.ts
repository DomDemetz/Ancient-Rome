export interface TradeNode {
  id: string
  name: string
  lat: number
  lng: number
  siteType: string
  province: string
  modern: string
}

export interface TradeRoute {
  id: string
  from: string
  to: string
  transportType: 'road' | 'sea' | 'river'
  distanceKm: number
  coordinates: [number, number][]
}

export interface TradeNetwork {
  sites: TradeNode[]
  routes: TradeRoute[]
}

export async function loadTradeNetwork(): Promise<TradeNetwork> {
  const data = await import('./orbis.json')
  return data.default as unknown as TradeNetwork
}
