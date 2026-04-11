import { useMemo } from 'react'
import { CircleMarker, Popup } from 'react-leaflet'
import type { NotablePerson } from '@/data/people-layer'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { formatYear } from '@/lib/geo'
import { esc } from '@/lib/wiki-popup'
import { useMapViewport } from '@/hooks/useMapViewport'

interface NotablePeopleLayerProps {
  data: NotablePerson[]
}

const PEOPLE_COLOR = '#c084fc' // soft purple — distinct from battles (red), settlements (warm), religion (violet)

function buildTooltipHtml(p: NotablePerson): string {
  let html = `<div class="map-tooltip-title">${esc(p.name)}</div>`
  const sub: string[] = []
  if (p.role && p.role !== 'unknown') sub.push(esc(p.role))
  sub.push(`${formatYear(p.born)}–${p.died != null ? formatYear(p.died) : '?'}`)
  if (sub.length) html += `<div class="map-tooltip-sub">${sub.join(' · ')}</div>`
  const details: string[] = []
  if (p.citizenship) details.push(esc(p.citizenship))
  if (p.domain) details.push(esc(p.domain))
  if (details.length) html += `<div class="map-tooltip-detail">${details.join(' · ')}</div>`
  html += `<div class="map-tooltip-detail" style="margin-top:4px"><a href="https://www.wikidata.org/wiki/${esc(p.wikidataId)}" target="_blank" rel="noopener" style="color:#d4a74a">Wikidata ↗</a></div>`
  return html
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
