import { useMemo } from 'react'
import { CircleMarker, Popup } from 'react-leaflet'
import type { NotablePerson } from '@/data/people-layer'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { formatYear } from '@/lib/geo'
import { buildPopup } from '@/lib/wiki-popup'
import { useMapViewport } from '@/hooks/useMapViewport'

interface NotablePeopleLayerProps {
  data: NotablePerson[]
}

const PEOPLE_COLOR = '#c084fc' // soft purple — distinct from battles (red), settlements (warm), religion (violet)

function buildTooltipHtml(p: NotablePerson): string {
  const sub: string[] = []
  if (p.role && p.role !== 'unknown') sub.push(p.role)
  sub.push(`${formatYear(p.born)}–${p.died != null ? formatYear(p.died) : '?'}`)
  const details: string[] = []
  if (p.citizenship) details.push(p.citizenship)
  if (p.domain) details.push(p.domain)
  return buildPopup({
    title: p.name,
    sub: sub.join(' · '),
    details,
    readMore: { id: p.wikidataId, layer: 'people', entityId: p.wikidataId, label: 'Read more' },
  })
}

function getRadius(notability: number, zoom: number): number {
  const base = zoom >= 7 ? 5 : zoom >= 5 ? 4 : 3
  if (notability > 35) return base + 3
  if (notability > 30) return base + 2
  if (notability > 25) return base + 1
  return base
}

export function NotablePeopleLayer({ data }: NotablePeopleLayerProps) {
  const { zoom, bounds } = useMapViewport()
  const currentYear = useTimelineStore((s) => s.currentYear)

  const visible = useMemo(() => {
    return data.filter((p) => {
      if (p.born > currentYear) return false
      if (p.died != null && p.died + 10 < currentYear) return false
      if (zoom < 4) return false

      if (zoom >= 6) {
        return (
          p.birthLat >= bounds.getSouth() &&
          p.birthLat <= bounds.getNorth() &&
          p.birthLng >= bounds.getWest() &&
          p.birthLng <= bounds.getEast()
        )
      }

      return true
    })
  }, [data, zoom, bounds, currentYear])

  return (
    <>
      {visible.map((p) => {
        const color = PEOPLE_COLOR
        const radius = getRadius(p.notability, zoom)
        const isDead = p.died != null && p.died < currentYear
        const fillOpacity = isDead ? 0.4 : 0.85

        return (
          <CircleMarker
            key={p.id}
            center={[p.birthLat, p.birthLng]}
            radius={radius}
            pathOptions={{
              color: '#000',
              weight: 1,
              fillColor: color,
              fillOpacity,
            }}
            bubblingMouseEvents={false}
          >
            <Popup offset={[0, -4]} closeButton={false}>
              <span dangerouslySetInnerHTML={{ __html: buildTooltipHtml(p) }} />
            </Popup>
          </CircleMarker>
        )
      })}
    </>
  )
}
