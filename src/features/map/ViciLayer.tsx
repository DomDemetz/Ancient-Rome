import { useMemo, useState, useCallback } from 'react'
import { CircleMarker, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { useTimelineStore } from '@/stores/useTimelineStore'

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

function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year)} BC`
  if (year > 0) return `${year} AD`
  return ''
}

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
  const [zoom, setZoom] = useState(map.getZoom())
  const [bounds, setBounds] = useState(map.getBounds())
  const currentYear = useTimelineStore((s) => s.currentYear)

  const updateView = useCallback(() => {
    setZoom(map.getZoom())
    setBounds(map.getBounds())
  }, [map])

  useMapEvents({
    zoomend: updateView,
    moveend: updateView,
  })

  const visible = useMemo(() => {
    // Don't show at very low zoom — too many points
    if (zoom < 7) return []

    let filtered = data.filter((s) => {
      // Timeline filtering
      if (s.startYear !== 0 && s.startYear > currentYear) return false
      if (s.endYear !== 0 && s.endYear < currentYear) return false

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

        const tooltipLines = [s.name || 'Unknown site']
        if (s.siteType !== 'other') tooltipLines.push(s.siteType)
        if (s.startYear || s.endYear) {
          const start = s.startYear ? formatYear(s.startYear) : '?'
          const end = s.endYear ? formatYear(s.endYear) : '?'
          tooltipLines.push(`${start} \u2013 ${end}`)
        }
        if (s.description) tooltipLines.push(s.description.substring(0, 100))

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
            <Tooltip direction="top" offset={[0, -4]}>
              <span style={{ whiteSpace: 'pre-line' }}>{tooltipLines.join('\n')}</span>
            </Tooltip>
          </CircleMarker>
        )
      })}
    </>
  )
}
