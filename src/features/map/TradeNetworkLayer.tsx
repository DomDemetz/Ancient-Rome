import { useMemo, useState, useCallback } from 'react'
import { CircleMarker, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import type { TradeNetwork } from '@/data/trade'

interface TradeNetworkLayerProps {
  data: TradeNetwork
}

const TRANSPORT_COLORS: Record<string, string> = {
  road: '#d4a574',
  sea: '#3498db',
  river: '#2ecc71',
}

const SITE_COLORS: Record<string, string> = {
  major_port: '#e74c3c',
  port: '#e67e22',
  city: '#f39c12',
  junction: '#95a5a6',
}

export function TradeNetworkLayer({ data }: TradeNetworkLayerProps) {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())
  const [bounds, setBounds] = useState(map.getBounds())

  const updateView = useCallback(() => {
    setZoom(map.getZoom())
    setBounds(map.getBounds())
  }, [map])

  useMapEvents({
    zoomend: updateView,
    moveend: updateView,
  })

  // Create lookup for sites
  const siteLookup = useMemo(() => {
    const lookup = new Map<string, (typeof data.sites)[number]>()
    for (const site of data.sites) {
      lookup.set(site.id, site)
    }
    return lookup
  }, [data])

  // Filter visible routes
  const visibleRoutes = useMemo(() => {
    if (zoom < 4) return []
    return data.routes.filter((r) => {
      if (!r.coordinates || r.coordinates.length < 2) return false
      if (zoom >= 7) {
        // Check if any coordinate is in bounds
        return r.coordinates.some(
          (c) =>
            c[1] >= bounds.getSouth() &&
            c[1] <= bounds.getNorth() &&
            c[0] >= bounds.getWest() &&
            c[0] <= bounds.getEast(),
        )
      }
      return true
    })
  }, [data.routes, zoom, bounds])

  // Filter visible sites
  const visibleSites = useMemo(() => {
    if (zoom < 4) return []
    return data.sites.filter((s) => {
      // At low zoom, only show major sites
      if (zoom < 6 && s.siteType !== 'major_port' && s.siteType !== 'city') return false
      if (zoom >= 7) {
        return (
          s.lat >= bounds.getSouth() &&
          s.lat <= bounds.getNorth() &&
          s.lng >= bounds.getWest() &&
          s.lng <= bounds.getEast()
        )
      }
      return true
    })
  }, [data.sites, zoom, bounds])

  const routeWeight = zoom >= 7 ? 2.5 : zoom >= 5 ? 2 : 1.5
  const siteRadius = zoom >= 7 ? 5 : zoom >= 5 ? 4 : 3

  return (
    <>
      {/* Routes */}
      {visibleRoutes.map((route) => {
        const color = TRANSPORT_COLORS[route.transportType] || '#95a5a6'
        const positions = route.coordinates.map((c) => [c[1], c[0]] as [number, number])
        const dashArray = route.transportType === 'sea' ? '4 4' : undefined

        return (
          <Polyline
            key={route.id}
            positions={positions}
            pathOptions={{
              color,
              weight: routeWeight,
              opacity: 0.6,
              dashArray,
            }}
          >
            <Tooltip sticky>
              {`${siteLookup.get(route.from)?.name || route.from} \u2192 ${siteLookup.get(route.to)?.name || route.to} (${route.transportType}, ${route.distanceKm}km)`}
            </Tooltip>
          </Polyline>
        )
      })}

      {/* Sites */}
      {visibleSites.map((site) => {
        const color = SITE_COLORS[site.siteType] || '#95a5a6'
        const radius = site.siteType === 'major_port' ? siteRadius + 1 : siteRadius

        return (
          <CircleMarker
            key={site.id}
            center={[site.lat, site.lng]}
            radius={radius}
            pathOptions={{
              color: '#2c3e50',
              weight: 1,
              fillColor: color,
              fillOpacity: 0.9,
            }}
            bubblingMouseEvents={false}
          >
            <Tooltip direction="top" offset={[0, -4]}>
              {`${site.name} (${site.siteType.replace('_', ' ')})`}
            </Tooltip>
          </CircleMarker>
        )
      })}
    </>
  )
}
