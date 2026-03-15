import { useMemo, useState, useCallback } from 'react'
import { CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet'
import type { Amphitheater } from '@/data/amphitheaters'
import { useTimelineStore } from '@/stores/useTimelineStore'

interface AmphitheaterLayerProps {
  data: Amphitheater[]
}

function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year)} BC`
  return `${year} AD`
}

function buildTooltipHtml(a: Amphitheater): string {
  let html = `<div class="map-tooltip-title">${a.name}</div>`
  if (a.city) html += `<div class="map-tooltip-sub">${a.city}</div>`
  const details: string[] = []
  if (a.capacity) details.push(`Capacity: ${a.capacity.toLocaleString()}`)
  if (a.dimensions) details.push(a.dimensions)
  if (a.constructionYear != null) details.push(`Built: ${formatYear(a.constructionYear)}`)
  if (details.length) html += `<div class="map-tooltip-detail">${details.join(' · ')}</div>`
  return html
}

export function AmphitheaterLayer({ data }: AmphitheaterLayerProps) {
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
      // Show amphitheaters that were built at or before the current year
      if (a.constructionYear != null && a.constructionYear > currentYear) return false

      // Zoom threshold - show at zoom 6+
      if (zoom < 6) return false

      // Bounds filtering at zoomed-in levels
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

  // Scale radius by capacity
  function getRadius(a: Amphitheater): number {
    if (!a.capacity) return zoom >= 7 ? 4 : 3
    if (a.capacity >= 40000) return zoom >= 7 ? 7 : 5
    if (a.capacity >= 20000) return zoom >= 7 ? 6 : 4
    if (a.capacity >= 10000) return zoom >= 7 ? 5 : 3.5
    return zoom >= 7 ? 4 : 3
  }

  return (
    <>
      {visible.map((a) => (
        <CircleMarker
          key={a.id}
          center={[a.lat, a.lng]}
          radius={getRadius(a)}
          pathOptions={{
            color: '#8b4513',
            weight: 1,
            fillColor: '#d4a574',
            fillOpacity: 0.85,
          }}
          bubblingMouseEvents={false}
        >
          <Popup offset={[0, -4]} closeButton={false}>
            <span dangerouslySetInnerHTML={{ __html: buildTooltipHtml(a) }} />
          </Popup>
        </CircleMarker>
      ))}
    </>
  )
}
