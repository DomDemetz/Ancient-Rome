import { useMemo } from 'react'
import { CircleMarker, Popup } from 'react-leaflet'
import type { EpigraphyCluster } from '@/data/epigraphy'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { esc } from '@/lib/wiki-popup'
import { formatYear } from '@/lib/geo'
import { useMapViewport } from '@/hooks/useMapViewport'

interface EpigraphyLayerProps {
  data: EpigraphyCluster[]
}

// Map inscription count to a visual radius (heatmap-like)
function getRadius(count: number, zoom: number): number {
  const base = zoom >= 7 ? 1.5 : 1
  if (count >= 3000) return base * 12
  if (count >= 1000) return base * 9
  if (count >= 500) return base * 7
  if (count >= 200) return base * 5.5
  if (count >= 100) return base * 4.5
  if (count >= 50) return base * 3.5
  return base * 2.5
}

function getOpacity(count: number): number {
  if (count >= 1000) return 0.6
  if (count >= 200) return 0.5
  if (count >= 50) return 0.4
  return 0.3
}

export function EpigraphyLayer({ data }: EpigraphyLayerProps) {
  const { zoom, bounds } = useMapViewport()
  const currentYear = useTimelineStore((s) => s.currentYear)

  const visible = useMemo(() => {
    return data.filter((c) => {
      if (c.startYear > currentYear) return false
      if (c.endYear < currentYear) return false
      if (zoom < 4) return false
      if (zoom >= 7) {
        return (
          c.lat >= bounds.getSouth() &&
          c.lat <= bounds.getNorth() &&
          c.lng >= bounds.getWest() &&
          c.lng <= bounds.getEast()
        )
      }
      return true
    })
  }, [data, zoom, bounds, currentYear])

  return (
    <>
      {visible.map((c) => (
        <CircleMarker
          key={c.id}
          center={[c.lat, c.lng]}
          radius={getRadius(c.count, zoom)}
          pathOptions={{
            color: 'transparent',
            fillColor: '#f1c40f',
            fillOpacity: getOpacity(c.count),
          }}
          bubblingMouseEvents={false}
        >
          <Popup offset={[0, -4]} closeButton={false}>
            <span
              dangerouslySetInnerHTML={{
                __html:
                  `<div class="map-tooltip-title">${esc(c.province)}</div>` +
                  `<div class="map-tooltip-detail">${c.count.toLocaleString()} inscriptions · ${formatYear(c.startYear)} \u2013 ${formatYear(c.endYear)}</div>`,
              }}
            />
          </Popup>
        </CircleMarker>
      ))}
    </>
  )
}
