import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { esc } from '@/lib/wiki-popup'
import { formatYear } from '@/lib/geo'
import { useMapViewport } from '@/hooks/useMapViewport'

interface ViciSite {
  id: string
  name: string
  lat: number
  lng: number
  siteType: string
  description: string
  startYear: number
  endYear: number
  territoryYear?: number | null
  declineYear?: number | null
}

interface ViciLayerProps {
  data: ViciSite[]
}

const TYPE_COLORS: Record<string, string> = {
  fort: '#e74c3c',
  settlement: '#f5e6c8',
  temple: '#f0c040',
  villa: '#7ec87e',
  cemetery: '#b07cc8',
  road: '#d4a574',
  bridge: '#6baed6',
  bath: '#3498db',
  theater: '#e67e22',
  amphitheater: '#d4a574',
  aqueduct: '#3498db',
  mine: '#c88c5a',
  port: '#2980b9',
  other: '#95a5a6',
}

// At low zoom, only show these types (most visually important)
const LOW_ZOOM_TYPES = new Set(['fort', 'settlement', 'temple', 'port'])
const MID_ZOOM_TYPES = new Set([
  'fort',
  'settlement',
  'temple',
  'port',
  'villa',
  'bath',
  'theater',
  'amphitheater',
])

// Spatial grid sampling for density control
function spatialSample<T extends { lat: number; lng: number }>(items: T[], gridSize: number): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${Math.floor(item.lat / gridSize)},${Math.floor(item.lng / gridSize)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function ViciLayer({ data }: ViciLayerProps) {
  const map = useMap()
  const { zoom, bounds } = useMapViewport()
  const currentYear = useTimelineStore((s) => s.currentYear)
  const popupRef = useRef<L.Popup | null>(null)

  const visible = useMemo(() => {
    if (zoom < 7) return []

    let filtered = data.filter((s) => {
      if (s.startYear !== 0 && s.startYear > currentYear) return false
      if (s.endYear !== 0 && s.endYear < currentYear) return false
      if (s.startYear === 0 && s.territoryYear != null) {
        if (currentYear < s.territoryYear + 20) return false
        if (s.declineYear != null && currentYear > s.declineYear + 50) return false
      }
      if (zoom < 9 && !LOW_ZOOM_TYPES.has(s.siteType)) return false
      if (zoom < 10 && !MID_ZOOM_TYPES.has(s.siteType)) return false
      return (
        s.lat >= bounds.getSouth() &&
        s.lat <= bounds.getNorth() &&
        s.lng >= bounds.getWest() &&
        s.lng <= bounds.getEast()
      )
    })

    if (filtered.length > 500) {
      const gridSize = zoom <= 8 ? 0.2 : zoom <= 10 ? 0.05 : 0.02
      filtered = spatialSample(filtered, gridSize)
    }

    return filtered
  }, [data, zoom, bounds, currentYear])

  const openPopup = useCallback(
    (s: ViciSite) => {
      let html = `<div class="map-tooltip-title">${s.name ? esc(s.name) : 'Unknown site'}</div>`
      if (s.siteType !== 'other') html += `<div class="map-tooltip-sub">${esc(s.siteType)}</div>`
      const details: string[] = []
      if (s.startYear || s.endYear) {
        const start = s.startYear ? formatYear(s.startYear) : '?'
        const end = s.endYear ? formatYear(s.endYear) : '?'
        details.push(`${start} – ${end}`)
      }
      if (s.description) details.push(esc(s.description.substring(0, 100)))
      if (details.length) html += `<div class="map-tooltip-detail">${details.join(' · ')}</div>`

      if (!popupRef.current) {
        popupRef.current = L.popup({ offset: [0, -4], closeButton: false })
      }
      popupRef.current.setLatLng([s.lat, s.lng]).setContent(`<span>${html}</span>`).openOn(map)
    },
    [map],
  )
  const openPopupRef = useRef(openPopup)
  useEffect(() => {
    openPopupRef.current = openPopup
  }, [openPopup])

  const markersRef = useRef<L.CircleMarker[]>([])

  useEffect(() => {
    for (const m of markersRef.current) m.remove()
    markersRef.current = []

    // a 2px dot is a ~4px hit target — visually right at survey zooms but
    // humanly unclickable; grow the marker (and with it Leaflet's hit area)
    // as the map closes in
    const baseRadius = zoom >= 14 ? 5 : zoom >= 11 ? 3.5 : 2

    for (const s of visible) {
      const color = TYPE_COLORS[s.siteType] || TYPE_COLORS.other
      const marker = L.circleMarker([s.lat, s.lng], {
        radius: baseRadius,
        color: 'transparent',
        fillColor: color,
        fillOpacity: 0.7,
        bubblingMouseEvents: false,
      })
      if (s.name) {
        marker.bindTooltip(esc(s.name), {
          direction: 'top',
          offset: [0, -baseRadius],
          className: 'name-tooltip',
        })
      }
      marker.on('mouseover', () => marker.setRadius(baseRadius + 2))
      marker.on('mouseout', () => marker.setRadius(baseRadius))
      marker.on('click', () => openPopupRef.current(s))
      marker.addTo(map)
      markersRef.current.push(marker)
    }
  }, [visible, zoom, map])

  useEffect(() => {
    return () => {
      for (const m of markersRef.current) m.remove()
      markersRef.current = []
    }
  }, [])

  return null
}
