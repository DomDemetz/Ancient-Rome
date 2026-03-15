import { useMemo, useState, useCallback } from 'react'
import { CircleMarker, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import type { Aqueduct } from '@/data/aqueducts'
import { useTimelineStore } from '@/stores/useTimelineStore'

interface AqueductLayerProps {
  data: Aqueduct[]
}

function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year)} BC`
  return `${year} AD`
}

export function AqueductLayer({ data }: AqueductLayerProps) {
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
    return data.filter((a) => {
      // Only show after construction
      if (a.constructionYear > currentYear) return false

      // Zoom threshold
      if (zoom < 6) return false

      // Bounds filtering
      if (zoom >= 7) {
        return (
          a.lat >= bounds.getSouth() &&
          a.lat <= bounds.getNorth() &&
          a.lng >= bounds.getWest() &&
          a.lng <= bounds.getEast()
        )
      }

      return true
    })
  }, [data, zoom, bounds, currentYear])

  const baseRadius = zoom >= 8 ? 5 : zoom >= 6 ? 4 : 3

  return (
    <>
      {visible.map((a) => {
        const tooltipLines = [
          a.name,
          `City: ${a.cityServed}`,
          `Built: ${formatYear(a.constructionYear)}`,
        ]
        if (a.length) tooltipLines.push(`Length: ${a.length} km`)
        if (a.builder) tooltipLines.push(`Builder: ${a.builder}`)
        if (a.description) tooltipLines.push(a.description)

        return (
          <CircleMarker
            key={a.id}
            center={[a.lat, a.lng]}
            radius={baseRadius}
            pathOptions={{
              color: '#1a5276',
              weight: 1,
              fillColor: '#3498db',
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
