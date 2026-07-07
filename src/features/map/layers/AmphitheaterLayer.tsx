import { useCallback, useMemo, useRef } from 'react'
import { CircleMarker, useMap } from 'react-leaflet'
import L from 'leaflet'
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
  const map = useMap()
  const { zoom, bounds } = useMapViewport()
  const currentYear = useTimelineStore((s) => s.currentYear)
  const wikiLookup = useWikiEnrichment('amphitheaters')
  const crossRef = useCrossRef()
  const popupRef = useRef<L.Popup | null>(null)

  const visible = useMemo(() => {
    const s = bounds.getSouth(),
      n = bounds.getNorth(),
      w = bounds.getWest(),
      e = bounds.getEast()
    return data.filter((a) => {
      if (a.constructionYear != null && a.constructionYear > currentYear) return false
      if (a.constructionYear == null && currentYear < -70) return false
      if (zoom < 6) return false
      return a.lat >= s && a.lat <= n && a.lng >= w && a.lng <= e
    })
  }, [data, zoom, bounds, currentYear])

  const openPopup = useCallback(
    (a: Amphitheater) => {
      const hasWiki = wikiLookup?.[a.id]
      let html = appendWikiTooltip(buildTooltipHtml(a), a.id, wikiLookup, 'amphitheaters')
      if (!hasWiki) {
        const crKey = `amphitheater:${a.id}`
        const crEntry = crossRef?.[crKey]
        if (crEntry) html = appendCrossRefTooltip(html, crEntry, { crKey })
      }
      if (!popupRef.current) {
        popupRef.current = L.popup({ offset: [0, -4], closeButton: false })
      }
      popupRef.current.setLatLng([a.lat, a.lng]).setContent(`<span>${html}</span>`).openOn(map)
    },
    [wikiLookup, crossRef, map],
  )

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
          eventHandlers={{ click: () => openPopup(a) }}
        />
      ))}
    </>
  )
}
