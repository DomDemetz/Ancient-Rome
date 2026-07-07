import { useMemo } from 'react'
import { CircleMarker, Polyline, Popup } from 'react-leaflet'
import type { TradeNetwork, TradeNode } from '@/data/trade'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useMapViewport } from '@/hooks/useMapViewport'
import { esc } from '@/lib/wiki-popup'
import { TRADE_ROLE_LABELS } from './placeTooltip'

interface TradeNetworkLayerProps {
  data: TradeNetwork
  /**
   * Settlements/Cities visible: the canonical place dots own every joined
   * site (site.node), so the trade layer draws only routes and the pure
   * topology junctions (capes, river mouths) that aren't places.
   */
  placesOn: boolean
}

// muted family — sea routes in a hushed slate-teal instead of loud cyan,
// so the network reads as currents under the empires, not a cage over them
const TRANSPORT_COLORS: Record<string, string> = {
  road: '#c2a077',
  sea: '#6d93a8',
  river: '#74a58e',
}

// Muted earth register (same family as the battle inks) — flat-UI
// red/orange dots read as a different product on the parchment atlas.
const SITE_COLORS: Record<string, string> = {
  major_port: '#c05548',
  port: '#c2913e',
  city: '#d9b45b',
  junction: '#97948a',
}

function shouldShowTemporal(
  territoryYear: number | null | undefined,
  declineYear: number | null | undefined,
  currentYear: number,
): boolean {
  if (territoryYear == null) return true
  if (currentYear < territoryYear + 20) return false
  if (declineYear != null && currentYear > declineYear + 50) return false
  return true
}

function getTemporalOpacity(
  territoryYear: number | null | undefined,
  declineYear: number | null | undefined,
  currentYear: number,
  baseOpacity: number,
): number {
  const visYear = (territoryYear ?? 0) + 20
  const fadeIn = Math.min(1, Math.max(0, (currentYear - visYear) / 30))
  let opacity = baseOpacity * fadeIn
  if (declineYear != null && currentYear > declineYear) {
    const decay = Math.min(1, (currentYear - declineYear) / 50)
    opacity *= 1 - decay
  }
  return opacity
}

function sitePopupHtml(site: TradeNode): string {
  let html = `<div class="map-tooltip-title">${esc(site.name)}</div>`
  const sub = [site.modern, site.province].filter(Boolean).map(esc)
  if (sub.length) html += `<div class="map-tooltip-sub">${sub.join(' · ')}</div>`
  const role = TRADE_ROLE_LABELS[site.siteType] ?? 'Trade site'
  html += `<div class="map-tooltip-detail">${role} · ORBIS network</div>`
  return html
}

export function TradeNetworkLayer({ data, placesOn }: TradeNetworkLayerProps) {
  const { zoom, bounds } = useMapViewport()
  const currentYear = useTimelineStore((s) => s.currentYear)

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
      // Temporal filtering
      if (!shouldShowTemporal(r.territoryYear, r.declineYear, currentYear)) return false
      if (zoom >= 7) {
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
  }, [data.routes, zoom, bounds, currentYear])

  // Filter visible sites
  const visibleSites = useMemo(() => {
    if (zoom < 4) return []
    return data.sites.filter((s) => {
      // Joined sites are settlements — when the places layer is on it owns
      // their dots (with the trade role in its popup); no double datapoints
      if (placesOn && s.node) return false
      // Temporal filtering
      if (!shouldShowTemporal(s.territoryYear, s.declineYear, currentYear)) return false
      // Fully faded-out (opacity 0) would still be an invisible click target
      if (getTemporalOpacity(s.territoryYear, s.declineYear, currentYear, 0.9) === 0) return false
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
  }, [data.sites, zoom, bounds, currentYear, placesOn])

  const routeWeight = zoom >= 7 ? 2 : zoom >= 5 ? 1.4 : 1
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
              opacity: getTemporalOpacity(
                route.territoryYear,
                route.declineYear,
                currentYear,
                0.45,
              ),
              dashArray,
            }}
          >
            <Popup closeButton={false}>
              {`${siteLookup.get(route.from)?.name || route.from} \u2192 ${siteLookup.get(route.to)?.name || route.to} (${route.transportType}, ${route.distanceKm}km)`}
            </Popup>
          </Polyline>
        )
      })}

      {/* Sites */}
      {visibleSites.map((site) => {
        const color = SITE_COLORS[site.siteType] || '#95a5a6'
        const radius = site.siteType === 'major_port' ? siteRadius + 1 : siteRadius
        // Stroke fades with the fill — a not-yet-faded-in site otherwise
        // renders as a ghost ring (dark outline around an empty center)
        const fillOpacity = getTemporalOpacity(
          site.territoryYear,
          site.declineYear,
          currentYear,
          0.9,
        )

        return (
          <CircleMarker
            key={site.id}
            center={[site.lat, site.lng]}
            radius={radius}
            pathOptions={{
              color: 'rgba(26, 18, 12, 0.85)',
              weight: 1,
              opacity: fillOpacity,
              fillColor: color,
              fillOpacity,
            }}
            bubblingMouseEvents={false}
          >
            <Popup offset={[0, -4]} closeButton={false}>
              <span dangerouslySetInnerHTML={{ __html: sitePopupHtml(site) }} />
            </Popup>
          </CircleMarker>
        )
      })}
    </>
  )
}
