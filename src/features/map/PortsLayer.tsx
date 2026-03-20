import { useMemo, useState, useCallback } from 'react'
import { CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useWikiEnrichment } from '@/hooks/useWikiEnrichment'
import { appendWikiTooltip, esc } from '@/lib/wiki-popup'

interface Port {
  id: string
  name: string
  lat: number
  lng: number
  portType: string
  description: string
  startYear: number
  endYear: number
  source: string
}

interface PortsLayerProps {
  data: Port[]
}

const PORT_COLORS: Record<string, string> = {
  major_port: '#e74c3c',
  port: '#e67e22',
  harbour: '#3498db',
  anchorage: '#95a5a6',
  lighthouse: '#f1c40f',
  shipyard: '#8e44ad',
}

const PORT_RADII: Record<string, number> = {
  major_port: 5,
  port: 4,
  harbour: 3,
  lighthouse: 3,
  shipyard: 3,
  anchorage: 2,
}

function spatialSample<T extends { lat: number; lng: number }>(items: T[], gridSize: number): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${Math.floor(item.lat / gridSize)},${Math.floor(item.lng / gridSize)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function PortsLayer({ data }: PortsLayerProps) {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())
  const [bounds, setBounds] = useState(map.getBounds())
  const currentYear = useTimelineStore((s) => s.currentYear)
  const wikiLookup = useWikiEnrichment('ports')

  const updateView = useCallback(() => {
    setZoom(map.getZoom())
    setBounds(map.getBounds())
  }, [map])

  useMapEvents({ zoomend: updateView, moveend: updateView })

  const visible = useMemo(() => {
    if (zoom < 6) return []

    let filtered = data.filter((p) => {
      if (p.startYear !== 0 && p.startYear > currentYear) return false
      if (p.endYear !== 0 && p.endYear < currentYear) return false

      // Progressive: only major ports at zoom 6-7
      if (
        zoom < 8 &&
        p.portType !== 'major_port' &&
        p.portType !== 'port' &&
        p.portType !== 'lighthouse'
      )
        return false

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

    if (filtered.length > 400) {
      filtered = spatialSample(filtered, zoom <= 8 ? 0.2 : 0.05)
    }

    return filtered
  }, [data, zoom, bounds, currentYear])

  return (
    <>
      {visible.map((p) => {
        const color = PORT_COLORS[p.portType] || '#3498db'
        const radius = (PORT_RADII[p.portType] || 3) * (zoom >= 9 ? 1.2 : 1)

        return (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={radius}
            pathOptions={{ color: '#1a3a5c', weight: 0.5, fillColor: color, fillOpacity: 0.8 }}
            bubblingMouseEvents={false}
          >
            <Popup key={wikiLookup ? 'w' : 'p'} offset={[0, -4]} closeButton={false}>
              <span
                dangerouslySetInnerHTML={{
                  __html: appendWikiTooltip(
                    `<div class="map-tooltip-title">${esc(p.name)}</div>` +
                      `<div class="map-tooltip-sub">${esc(p.portType.replaceAll('_', ' '))}</div>` +
                      (p.description
                        ? `<div class="map-tooltip-detail">${esc(p.description)}</div>`
                        : ''),
                    p.id,
                    wikiLookup,
                    'ports',
                  ),
                }}
              />
            </Popup>
          </CircleMarker>
        )
      })}
    </>
  )
}
