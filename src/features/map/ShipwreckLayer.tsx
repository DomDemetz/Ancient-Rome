import { useMemo, useState, useCallback } from 'react'
import { CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet'
import type { Shipwreck } from '@/data/shipwrecks'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { esc } from '@/lib/wiki-popup'

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

// Spatial grid sampling: at low zoom, only show one wreck per grid cell
function spatialSample<T extends { lat: number; lng: number }>(items: T[], gridSize: number): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${Math.floor(item.lat / gridSize)},${Math.floor(item.lng / gridSize)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
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
    let filtered = data.filter((w) => {
      if (w.startYear > currentYear) return false
      if (zoom < 5) return false
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

    // At low zoom, spatially sample to reduce density
    if (zoom < 7 && filtered.length > 300) {
      const gridSize = zoom <= 5 ? 1.0 : 0.5
      filtered = spatialSample(filtered, gridSize)
    }

    return filtered
  }, [data, zoom, bounds, currentYear])

  const baseRadius = zoom >= 7 ? 4 : zoom >= 5 ? 3 : 2

  return (
    <>
      {visible.map((w) => {
        const color = CARGO_COLORS[w.cargoType ?? ''] || '#3498db'
        const isRecent = currentYear - w.startYear < 100
        const opacity = isRecent ? 0.8 : 0.5

        let tooltipHtml = `<div class="map-tooltip-title">${esc(w.name)}</div>`
        const sub: string[] = []
        if (w.cargoType) sub.push(esc(w.cargoType))
        if (sub.length) tooltipHtml += `<div class="map-tooltip-sub">${sub.join(' · ')}</div>`
        const details: string[] = [`${formatYear(w.startYear)} \u2013 ${formatYear(w.endYear)}`]
        if (w.depth) details.push(`Depth: ${w.depth}m`)
        if (w.description) details.push(esc(w.description))
        tooltipHtml += `<div class="map-tooltip-detail">${details.join(' · ')}</div>`

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
            <Popup offset={[0, -4]} closeButton={false}>
              <span dangerouslySetInnerHTML={{ __html: tooltipHtml }} />
            </Popup>
          </CircleMarker>
        )
      })}
    </>
  )
}
