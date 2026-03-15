import { useMemo, useState, useCallback } from 'react'
import { CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet'
import type { Press } from '@/data/presses'
import { useTimelineStore } from '@/stores/useTimelineStore'

interface PressesLayerProps {
  data: Press[]
}

const PRESS_COLORS: Record<string, string> = {
  oil: '#8b6914',
  wine: '#722f37',
}

function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year)} BC`
  return `${year} AD`
}

export function PressesLayer({ data }: PressesLayerProps) {
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
    return data.filter((p) => {
      if (p.startYear > currentYear) return false
      if (p.endYear !== 0 && p.endYear < currentYear) return false
      if (zoom < 7) return false
      if (zoom >= 7) {
        return (
          p.lat >= bounds.getSouth() &&
          p.lat <= bounds.getNorth() &&
          p.lng >= bounds.getWest() &&
          p.lng <= bounds.getEast()
        )
      }
      return true
    })
  }, [data, zoom, bounds, currentYear])

  const baseRadius = zoom >= 8 ? 4 : 3

  return (
    <>
      {visible.map((p) => {
        const color = PRESS_COLORS[p.pressType] || '#8b6914'

        let tooltipHtml = `<div class="map-tooltip-title">${p.name}</div>`
        tooltipHtml += `<div class="map-tooltip-sub">${p.pressType === 'oil' ? 'Olive oil' : 'Wine'} press</div>`
        const details: string[] = [`${formatYear(p.startYear)} \u2013 ${formatYear(p.endYear)}`]
        if (p.description) details.push(p.description)
        tooltipHtml += `<div class="map-tooltip-detail">${details.join(' · ')}</div>`

        return (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={baseRadius}
            pathOptions={{
              color: '#4a3728',
              weight: 0.5,
              fillColor: color,
              fillOpacity: 0.8,
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
