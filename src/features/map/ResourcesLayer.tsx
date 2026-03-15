import { useMemo, useState, useCallback } from 'react'
import { CircleMarker, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import type { Mine } from '@/data/mines'
import { useTimelineStore } from '@/stores/useTimelineStore'

interface ResourcesLayerProps {
  data: Mine[]
}

const RESOURCE_COLORS: Record<string, string> = {
  gold: '#ffd700',
  silver: '#c0c0c0',
  copper: '#b87333',
  iron: '#434343',
  tin: '#d4d4d4',
  lead: '#5a5a5a',
  marble: '#f5f5f5',
  granite: '#a0785a',
  limestone: '#e8dcc8',
  porphyry: '#6a0dad',
}

function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year)} BC`
  return `${year} AD`
}

export function ResourcesLayer({ data }: ResourcesLayerProps) {
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
    return data.filter((m) => {
      // Timeline filtering
      if (m.startYear !== 0 && m.startYear > currentYear) return false
      if (m.endYear !== 0 && m.endYear < currentYear) return false

      // Zoom threshold
      if (zoom < 6) return false

      // Bounds filtering
      if (zoom >= 7) {
        return (
          m.lat >= bounds.getSouth() &&
          m.lat <= bounds.getNorth() &&
          m.lng >= bounds.getWest() &&
          m.lng <= bounds.getEast()
        )
      }

      return true
    })
  }, [data, zoom, bounds, currentYear])

  const baseRadius = zoom >= 7 ? 5 : 4

  return (
    <>
      {visible.map((m) => {
        const color = RESOURCE_COLORS[m.resourceType] || '#95a5a6'

        let tooltipHtml = `<div class="map-tooltip-title">${m.name}</div>`
        tooltipHtml += `<div class="map-tooltip-sub">${m.siteType === 'mine' ? 'Mine' : 'Quarry'}: ${m.resourceType}</div>`
        const details: string[] = [`${formatYear(m.startYear)} \u2013 ${formatYear(m.endYear)}`]
        if (m.description) details.push(m.description)
        tooltipHtml += `<div class="map-tooltip-detail">${details.join(' · ')}</div>`

        return (
          <CircleMarker
            key={m.id}
            center={[m.lat, m.lng]}
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
              <span dangerouslySetInnerHTML={{ __html: tooltipHtml }} />
            </Tooltip>
          </CircleMarker>
        )
      })}
    </>
  )
}
