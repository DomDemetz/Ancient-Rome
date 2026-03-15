import { useMemo, useState, useCallback } from 'react'
import { CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet'
import type { ReligiousSite } from '@/data/religion'
import { useTimelineStore } from '@/stores/useTimelineStore'

interface ReligionLayerProps {
  data: ReligiousSite[]
}

const RELIGION_COLORS: Record<string, string> = {
  roman: '#d4af37',
  greek: '#f0c040',
  egyptian: '#e67e22',
  christian: '#3498db',
  mithras: '#e74c3c',
  jewish: '#2ecc71',
  syncretic: '#9b59b6',
}

const SITE_TYPE_SHAPES: Record<string, number> = {
  temple: 5,
  sanctuary: 4,
  mithraeum: 4,
  church: 5,
  synagogue: 4,
  oracle: 6,
  shrine: 3,
}

function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year)} BC`
  return `${year} AD`
}

export function ReligionLayer({ data }: ReligionLayerProps) {
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
    return data.filter((s) => {
      if (s.startYear > currentYear) return false
      if (s.endYear !== 0 && s.endYear < currentYear) return false
      if (zoom < 6) return false
      if (zoom >= 7) {
        return (
          s.lat >= bounds.getSouth() &&
          s.lat <= bounds.getNorth() &&
          s.lng >= bounds.getWest() &&
          s.lng <= bounds.getEast()
        )
      }
      return true
    })
  }, [data, zoom, bounds, currentYear])

  const baseRadius = zoom >= 8 ? 5 : zoom >= 6 ? 4 : 3

  return (
    <>
      {visible.map((s) => {
        const color = RELIGION_COLORS[s.religion] || '#95a5a6'
        const radius = SITE_TYPE_SHAPES[s.siteType] || baseRadius

        let tooltipHtml = `<div class="map-tooltip-title">${s.name}</div>`
        const sub: string[] = [
          `${s.religion.charAt(0).toUpperCase() + s.religion.slice(1)} ${s.siteType}`,
        ]
        if (s.deity) sub.push(s.deity)
        tooltipHtml += `<div class="map-tooltip-sub">${sub.join(' · ')}</div>`
        const details: string[] = [`${formatYear(s.startYear)} \u2013 ${formatYear(s.endYear)}`]
        if (s.description) details.push(s.description)
        tooltipHtml += `<div class="map-tooltip-detail">${details.join(' · ')}</div>`

        return (
          <CircleMarker
            key={s.id}
            center={[s.lat, s.lng]}
            radius={radius}
            pathOptions={{
              color: '#2c3e50',
              weight: 1,
              fillColor: color,
              fillOpacity: 0.85,
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
