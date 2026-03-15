import { useMemo, useState, useCallback } from 'react'
import { CircleMarker, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import type { Shipwreck } from '@/data/shipwrecks'
import { useTimelineStore } from '@/stores/useTimelineStore'

interface ShipwreckLayerProps {
  data: Shipwreck[]
}

const CARGO_COLORS: Record<string, string> = {
  amphora: '#c0392b',
  marble: '#ecf0f1',
  grain: '#f39c12',
  metal: '#7f8c8d',
  mixed: '#8e44ad',
  'building materials': '#d4a574',
}

function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year)} BC`
  return `${year} AD`
}

export function ShipwreckLayer({ data }: ShipwreckLayerProps) {
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
    return data.filter((w) => {
      // Show wrecks from their estimated period up to present
      if (w.startYear > currentYear) return false

      // Zoom threshold - show at zoom 5+
      if (zoom < 5) return false

      // Bounds filtering
      if (zoom >= 7) {
        return (
          w.lat >= bounds.getSouth() &&
          w.lat <= bounds.getNorth() &&
          w.lng >= bounds.getWest() &&
          w.lng <= bounds.getEast()
        )
      }

      return true
    })
  }, [data, zoom, bounds, currentYear])

  const baseRadius = zoom >= 7 ? 4 : zoom >= 5 ? 3 : 2

  return (
    <>
      {visible.map((w) => {
        const color = CARGO_COLORS[w.cargoType ?? ''] || '#3498db'
        // More recent wrecks are brighter
        const isRecent = currentYear - w.startYear < 100
        const opacity = isRecent ? 0.8 : 0.5

        const tooltipLines = [w.name, `${formatYear(w.startYear)} \u2013 ${formatYear(w.endYear)}`]
        if (w.cargoType) tooltipLines.push(`Cargo: ${w.cargoType}`)
        if (w.depth) tooltipLines.push(`Depth: ${w.depth}m`)
        if (w.description) tooltipLines.push(w.description)

        return (
          <CircleMarker
            key={w.id}
            center={[w.lat, w.lng]}
            radius={baseRadius}
            pathOptions={{
              color: '#1a5276',
              weight: 0.5,
              fillColor: color,
              fillOpacity: opacity,
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
