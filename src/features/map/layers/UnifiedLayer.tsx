import { useMemo } from 'react'
import { CircleMarker, Popup } from 'react-leaflet'
import type { UnifiedEntity } from '@/data/unified'
import type { CrossRefEnrichment } from '@/data/wiki'
import { useMapViewport } from '@/hooks/useMapViewport'
import { useCrossRef } from '@/hooks/useWikiEnrichment'
import { appendCrossRefTooltip, esc } from '@/lib/wiki-popup'
import { formatYear } from '@/lib/geo'

interface UnifiedLayerProps {
  data: UnifiedEntity[]
  color: string
  fillColor: string
  crPrefix?: string
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

function stripPrefix(id: string): string {
  const i = id.indexOf(':')
  return i >= 0 ? id.slice(i + 1) : id
}

export function UnifiedLayer({ data, color, fillColor, crPrefix }: UnifiedLayerProps) {
  const { zoom, bounds } = useMapViewport()
  const crossRef = useCrossRef()

  const visible = useMemo(() => {
    if (zoom < 5) return []

    let filtered = data.filter((e) => {
      if (zoom >= 7) {
        return (
          e.lat >= bounds.getSouth() &&
          e.lat <= bounds.getNorth() &&
          e.lng >= bounds.getWest() &&
          e.lng <= bounds.getEast()
        )
      }
      return true
    })

    if (zoom < 7 && filtered.length > 500) {
      const gridSize = zoom <= 5 ? 1.0 : 0.5
      filtered = spatialSample(filtered, gridSize)
    }

    return filtered
  }, [data, zoom, bounds])

  const baseRadius = zoom >= 8 ? 5 : zoom >= 7 ? 4 : zoom >= 5 ? 3 : 2

  return (
    <>
      {visible.map((e) => {
        let html = `<div class="map-tooltip-title">${esc(e.name)}</div>`
        const sub: string[] = []
        if (e.type) sub.push(e.type)
        if (e.subtype && e.subtype !== e.type) sub.push(e.subtype)
        if (sub.length) html += `<div class="map-tooltip-sub">${esc(sub.join(' · '))}</div>`
        const details: string[] = []
        if (e.startYear != null) {
          details.push(
            e.endYear != null
              ? `${formatYear(e.startYear)} – ${formatYear(e.endYear)}`
              : formatYear(e.startYear),
          )
        }
        const desc = e.description
        if (desc) details.push(esc(desc.length > 120 ? desc.slice(0, 117) + '...' : desc))
        if (details.length) html += `<div class="map-tooltip-detail">${details.join(' · ')}</div>`

        let cr: CrossRefEnrichment | undefined
        let crKey: string | undefined
        if (crPrefix) {
          crKey = `${crPrefix}:${stripPrefix(e.id)}`
          cr = crossRef?.[crKey]
        }
        if (cr && crKey) {
          html = appendCrossRefTooltip(html, cr, { crKey })
        }

        return (
          <CircleMarker
            key={e.id}
            center={[e.lat, e.lng]}
            radius={baseRadius}
            pathOptions={{
              color,
              weight: 0.5,
              fillColor,
              fillOpacity: 0.7,
            }}
            bubblingMouseEvents={false}
          >
            <Popup offset={[0, -4]} closeButton={false}>
              <span dangerouslySetInnerHTML={{ __html: html }} />
            </Popup>
          </CircleMarker>
        )
      })}
    </>
  )
}
