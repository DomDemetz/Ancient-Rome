import { useMemo } from 'react'
import { CircleMarker, Popup } from 'react-leaflet'
import type { Amphitheater } from '@/data/amphitheaters'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useWikiEnrichment, useCrossRef } from '@/hooks/useWikiEnrichment'
import { appendWikiTooltip, appendCrossRefTooltip, esc } from '@/lib/wiki-popup'
import { formatYear } from '@/lib/geo'
import { useMapViewport } from '@/hooks/useMapViewport'

interface AmphitheaterLayerProps {
  data: Amphitheater[]
}

function buildTooltipHtml(a: Amphitheater): string {
  let html = `<div class="map-tooltip-title">${esc(a.name)}</div>`
  if (a.city) html += `<div class="map-tooltip-sub">${esc(a.city)}</div>`
  const details: string[] = []
  if (a.capacity) details.push(`Capacity: ${a.capacity.toLocaleString()}`)
  if (a.dimensions) details.push(esc(a.dimensions))
  if (a.constructionYear != null) details.push(`Built: ${formatYear(a.constructionYear)}`)
  if (details.length) html += `<div class="map-tooltip-detail">${details.join(' · ')}</div>`
  return html
}

export function AmphitheaterLayer({ data }: AmphitheaterLayerProps) {
  const { zoom, bounds } = useMapViewport()
  const currentYear = useTimelineStore((s) => s.currentYear)
  const wikiLookup = useWikiEnrichment('amphitheaters')
  const crossRef = useCrossRef()

  const visible = useMemo(() => {
    return data.filter((a) => {
      // Show amphitheaters that were built at or before the current year.
      // Undated ones wait for the building type to exist at all — the oldest
      // known stone amphitheater (Pompeii) is ~70 BC; before that an undated
      // dot is an anachronism, not a maybe.
      if (a.constructionYear != null && a.constructionYear > currentYear) return false
      if (a.constructionYear == null && currentYear < -70) return false

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
          <Popup key={wikiLookup ? 'w' : 'p'} offset={[0, -4]} closeButton={false}>
            <span
              dangerouslySetInnerHTML={{
                __html: (() => {
                  const hasWiki = wikiLookup?.[a.id]
                  let html = appendWikiTooltip(
                    buildTooltipHtml(a),
                    a.id,
                    wikiLookup,
                    'amphitheaters',
                  )
                  if (!hasWiki) {
                    const crKey = `amphitheater:${a.id}`
                    const crEntry = crossRef?.[crKey]
                    if (crEntry) {
                      html = appendCrossRefTooltip(html, crEntry, { crKey })
                    }
                  }
                  return html
                })(),
              }}
            />
          </Popup>
        </CircleMarker>
      ))}
    </>
  )
}
