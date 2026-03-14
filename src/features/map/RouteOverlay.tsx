import { Polyline, Tooltip } from 'react-leaflet'

export interface Route {
  id: string
  name: string
  coordinates: [number, number][]
  type: 'military' | 'trade' | 'road'
}

interface RouteOverlayProps {
  routes: Route[]
}

const ROUTE_COLORS: Record<Route['type'], string> = {
  military: '#c0392b',
  trade: '#f39c12',
  road: '#7f8c8d',
}

export function RouteOverlay({ routes }: RouteOverlayProps) {
  return (
    <>
      {routes.map((route) => {
        const color = ROUTE_COLORS[route.type]
        const isDashed = route.type === 'trade'

        return (
          <Polyline
            key={route.id}
            positions={route.coordinates}
            pathOptions={{
              color,
              weight: 2,
              opacity: 0.8,
              dashArray: isDashed ? '6 4' : undefined,
            }}
          >
            <Tooltip sticky>{route.name}</Tooltip>
          </Polyline>
        )
      })}
    </>
  )
}
