import { useMemo } from 'react'
import { CircleMarker, Popup } from 'react-leaflet'
import type { UnifiedEntity } from '@/data/unified'
import type { DatasetConfig } from '@/data/datasetRegistry'
import { useMapViewport } from '@/hooks/useMapViewport'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useCrossRef } from '@/hooks/useWikiEnrichment'
import { appendCrossRefTooltip, appendWikiTooltip, esc } from '@/lib/wiki-popup'
import { useWikiEnrichment } from '@/hooks/useWikiEnrichment'
import nodeJoinRaw from '@/data/registry/unified-nodes.json?raw'

// unified entity -> its canonical place node (ENTITY-MODEL.md join):
// "same" = this record IS the town; "at" = it sits at/near it.
const NODE_JOIN = JSON.parse(nodeJoinRaw) as Record<
  string,
  { node: string; name: string; km: number; rel: 'same' | 'at' }
>
import { formatYear } from '@/lib/geo'

interface UnifiedLayerProps {
  data: UnifiedEntity[]
  config?: DatasetConfig
  color?: string
  fillColor?: string
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

function getField(e: UnifiedEntity, field: string): string {
  if (field === 'subtype') return e.subtype ?? ''
  if (field === 'category') return e.category ?? ''
  if (field.startsWith('props.')) return (e.props?.[field.slice(6)] as string) ?? ''
  return ((e as unknown as Record<string, string>)[field] as string) ?? ''
}

export function UnifiedLayer({ data, config, color, fillColor }: UnifiedLayerProps) {
  const { zoom, bounds } = useMapViewport()
  const crossRef = useCrossRef()
  // consolidated graph-keyed knowledge (extract + thumbnail, one lookup)
  const knowledge = useWikiEnrichment('knowledge-features')
  const currentYear = useTimelineStore((s) => s.currentYear)

  const strokeColor = config?.color ?? color ?? '#666'
  const defaultFill = config?.fillColor ?? fillColor ?? '#999'
  const minZoom = config?.minZoom ?? 5
  const maxSample = config?.maxSample ?? 500
  const temporal = config?.temporalFilter ?? false
  const colorField = config?.colorField
  const colorMap = config?.colorMap

  const visible = useMemo(() => {
    if (zoom < minZoom) return []

    let filtered = data.filter((e) => {
      if (temporal) {
        const start = e.startYear ?? 0
        const end = e.endYear ?? 0
        if (start !== 0 && start > currentYear) return false
        if (end !== 0 && end < currentYear) return false
      }
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

    if (zoom < 7 && filtered.length > maxSample) {
      const gridSize = zoom <= 5 ? 1.0 : 0.5
      filtered = spatialSample(filtered, gridSize)
    }

    return filtered
  }, [data, zoom, bounds, currentYear, minZoom, maxSample, temporal])

  const baseRadius = zoom >= 8 ? 5 : zoom >= 7 ? 4 : zoom >= 5 ? 3 : 2

  return (
    <>
      {visible.map((e) => {
        const itemFill =
          colorField && colorMap ? (colorMap[getField(e, colorField)] ?? defaultFill) : defaultFill

        let html = `<div class="map-tooltip-title">${esc(e.name)}</div>`
        const sub: string[] = []
        if (e.type) sub.push(e.type)
        if (e.subtype && e.subtype !== e.type) sub.push(e.subtype)
        if (sub.length) html += `<div class="map-tooltip-sub">${esc(sub.join(' · '))}</div>`
        const details: string[] = []
        if (e.startYear != null && e.startYear !== 0) {
          details.push(
            e.endYear != null && e.endYear !== 0
              ? `${formatYear(e.startYear)} – ${formatYear(e.endYear)}`
              : formatYear(e.startYear),
          )
        }
        const desc = e.description
        if (desc) details.push(esc(desc.length > 120 ? desc.slice(0, 117) + '...' : desc))
        if (details.length) html += `<div class="map-tooltip-detail">${details.join(' · ')}</div>`

        // geographic anchor from the entity join — "At Rome" / "Near Nikopolis"
        const join = NODE_JOIN[e.id]
        if (join && join.rel === 'at' && join.name !== e.name) {
          html += `<div class="map-tooltip-detail">${join.km <= 2 ? 'At' : 'Near'} ${esc(join.name)}${join.km > 2 ? ` · ${join.km} km` : ''}</div>`
        }

        const k = knowledge?.[e.id]
        const cr = crossRef?.[e.id]
        if (k?.extract) {
          html = appendWikiTooltip(html, e.id, knowledge, 'knowledge-features')
        } else if (cr) {
          html = appendCrossRefTooltip(html, cr, { crKey: e.id })
        }

        return (
          <CircleMarker
            key={e.id}
            center={[e.lat, e.lng]}
            radius={baseRadius}
            pathOptions={{
              color: strokeColor,
              weight: 0.5,
              fillColor: itemFill,
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
