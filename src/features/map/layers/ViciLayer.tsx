import { useMemo } from 'react'
import { CircleMarker, Popup } from 'react-leaflet'
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
  source: string
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
  const { zoom, bounds } = useMapViewport()
  const currentYear = useTimelineStore((s) => s.currentYear)

  const visible = useMemo(() => {
    // Don't show at very low zoom — too many points
    if (zoom < 7) return []

    let filtered = data.filter((s) => {
      // Timeline filtering
      if (s.startYear !== 0 && s.startYear > currentYear) return false
      if (s.endYear !== 0 && s.endYear < currentYear) return false
      // Territory-correlated undated sites
      if (s.startYear === 0 && s.territoryYear != null) {
        if (currentYear < s.territoryYear + 20) return false
        if (s.declineYear != null && currentYear > s.declineYear + 50) return false
      }

      // Type filtering by zoom
      if (zoom < 9 && !LOW_ZOOM_TYPES.has(s.siteType)) return false
      if (zoom < 10 && !MID_ZOOM_TYPES.has(s.siteType)) return false

      // Bounds filtering
      return (
        s.lat >= bounds.getSouth() &&
        s.lat <= bounds.getNorth() &&
        s.lng >= bounds.getWest() &&
        s.lng <= bounds.getEast()
      )
    })

    // Spatial sampling if still too many
    if (filtered.length > 500) {
      const gridSize = zoom <= 8 ? 0.2 : zoom <= 10 ? 0.05 : 0.02
      filtered = spatialSample(filtered, gridSize)
    }

    return filtered
  }, [data, zoom, bounds, currentYear])

  return (
    <>
      {visible.map((s) => {
        const color = TYPE_COLORS[s.siteType] || TYPE_COLORS.other

        let tooltipHtml = `<div class="map-tooltip-title">${s.name ? esc(s.name) : 'Unknown site'}</div>`
        if (s.siteType !== 'other')
          tooltipHtml += `<div class="map-tooltip-sub">${esc(s.siteType)}</div>`
        const details: string[] = []
        if (s.startYear || s.endYear) {
          const start = s.startYear ? formatYear(s.startYear) : '?'
          const end = s.endYear ? formatYear(s.endYear) : '?'
          details.push(`${start} \u2013 ${end}`)
        }
        if (s.description) details.push(esc(s.description.substring(0, 100)))
        if (details.length)
          tooltipHtml += `<div class="map-tooltip-detail">${details.join(' · ')}</div>`

        return (
          <CircleMarker
            key={s.id}
            center={[s.lat, s.lng]}
            radius={2}
            pathOptions={{
              color: 'transparent',
              fillColor: color,
              fillOpacity: 0.7,
            }}
            bubblingMouseEvents={false}
          >
            <Popup offset={[0, -4]} closeButton={false}>
              <span dangerouslySetInnerHTML={{ __html: tooltipHtml }} />
            </Popup>
          </CircleMarker>
        )
      })}
    </>
  )
}
