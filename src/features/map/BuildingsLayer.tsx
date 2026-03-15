import { useMemo, useState, useCallback } from 'react'
import { CircleMarker, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import type { Building } from '@/data/buildings'
import { useTimelineStore } from '@/stores/useTimelineStore'

interface BuildingsLayerProps {
  data: Building[]
}

const BUILDING_COLORS: Record<string, string> = {
  temple: '#f0c040',
  theater: '#e74c3c',
  bath: '#3498db',
  forum: '#d4af37',
  circus: '#e67e22',
  basilica: '#9b59b6',
  arch: '#c0392b',
  column: '#bdc3c7',
  palace: '#8e44ad',
  library: '#2ecc71',
}

function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year)} BC`
  return `${year} AD`
}

export function BuildingsLayer({ data }: BuildingsLayerProps) {
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
    return data.filter((b) => {
      if (b.constructionYear > currentYear) return false
      // Progressive disclosure: show major buildings at zoom 6+, all at 8+
      if (zoom < 6) return false
      if (zoom < 8) {
        // At low zoom, only show major building types
        const majorTypes = ['forum', 'circus', 'palace', 'library']
        if (!majorTypes.includes(b.buildingType)) return false
      }
      if (zoom >= 7) {
        return (
          b.lat >= bounds.getSouth() &&
          b.lat <= bounds.getNorth() &&
          b.lng >= bounds.getWest() &&
          b.lng <= bounds.getEast()
        )
      }
      return true
    })
  }, [data, zoom, bounds, currentYear])

  const baseRadius = zoom >= 8 ? 5 : zoom >= 6 ? 4 : 3

  return (
    <>
      {visible.map((b) => {
        const color = BUILDING_COLORS[b.buildingType] || '#95a5a6'

        const tooltipLines = [
          b.name,
          b.buildingType.charAt(0).toUpperCase() + b.buildingType.slice(1),
          `Built: ${formatYear(b.constructionYear)}`,
        ]
        if (b.builder) tooltipLines.push(`Builder: ${b.builder}`)
        if (b.description) tooltipLines.push(b.description)

        return (
          <CircleMarker
            key={b.id}
            center={[b.lat, b.lng]}
            radius={baseRadius}
            pathOptions={{
              color: '#2c3e50',
              weight: 1,
              fillColor: color,
              fillOpacity: 0.85,
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
