import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import type { UnifiedEntity } from '@/data/unified'
import type { DatasetConfig } from '@/data/datasetRegistry'
import { useMapViewport } from '@/hooks/useMapViewport'
import { useTimelineStore } from '@/stores/useTimelineStore'
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
  const map = useMap()
  const { zoom, bounds } = useMapViewport()
  // consolidated graph-keyed knowledge (extract + thumbnail, one lookup)
  const knowledge = useWikiEnrichment('knowledge-features')
  const popupRef = useRef<L.Popup | null>(null)
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

    const s = bounds.getSouth(),
      n = bounds.getNorth(),
      w = bounds.getWest(),
      e2 = bounds.getEast()
    let filtered = data.filter((e) => {
      if (temporal) {
        const start = e.startYear ?? 0
        const end = e.endYear ?? 0
        if (start !== 0 && start > currentYear) return false
        if (end !== 0 && end < currentYear) return false
      }
      return e.lat >= s && e.lat <= n && e.lng >= w && e.lng <= e2
    })

    if (zoom < 7 && filtered.length > maxSample) {
      const gridSize = zoom <= 5 ? 1.0 : 0.5
      filtered = spatialSample(filtered, gridSize)
    }

    return filtered
  }, [data, zoom, bounds, currentYear, minZoom, maxSample, temporal])

  const openPopup = useCallback(
    (e: UnifiedEntity) => {
      let html = `<div class="map-tooltip-title">${esc(e.name)}</div>`
      const sub: string[] = []
      if (e.type) sub.push(e.type)
      if (e.subtype && e.subtype !== e.type) sub.push(e.subtype)
      if (sub.length) html += `<div class="map-tooltip-sub">${esc(sub.join(' · '))}</div>`

      const k = knowledge?.[e.id]
      const cr = k?.crossRef
      const hasEnrichment = !!(k?.extract || cr)

      const details: string[] = []
      if (e.startYear != null && e.startYear !== 0) {
        details.push(
          e.endYear != null && e.endYear !== 0
            ? `${formatYear(e.startYear)} – ${formatYear(e.endYear)}`
            : formatYear(e.startYear),
        )
      }
      const desc = e.description
      const isCiteOnly = desc?.startsWith('An ancient place, cited:')
      if (hasEnrichment && desc) {
        details.push(esc(desc.length > 120 ? desc.slice(0, 117) + '...' : desc))
      }
      if (details.length) html += `<div class="map-tooltip-detail">${details.join(' · ')}</div>`

      const join = NODE_JOIN[e.id]
      if (join && join.rel === 'at' && join.name !== e.name) {
        html += `<div class="map-tooltip-detail">${join.km <= 2 ? 'At' : 'Near'} ${esc(join.name)}${join.km > 2 ? ` · ${join.km} km` : ''}</div>`
      }

      if (k?.extract) {
        html = appendWikiTooltip(html, e.id, knowledge, 'knowledge-features')
      } else if (cr) {
        html = appendCrossRefTooltip(html, cr, { crKey: e.id })
      } else {
        html += '<div class="map-tooltip-wiki">'
        if (desc && !isCiteOnly) {
          html += `<div class="map-tooltip-extract">${esc(desc)}</div>`
        }
        const facts: string[] = []
        const ancientName = e.props?.ancientName as string | undefined
        if (ancientName && ancientName !== e.name) facts.push(`Ancient name: ${ancientName}`)
        const depth = e.props?.depth as number | undefined
        if (depth != null) facts.push(`Depth: ${depth}m`)
        const siteType = e.props?.siteType as string | undefined
        if (siteType && siteType !== e.subtype)
          facts.push(siteType.charAt(0).toUpperCase() + siteType.slice(1))
        if (facts.length) {
          html += `<div class="map-tooltip-fact">${esc(facts.join(' · '))}</div>`
        }
        if (isCiteOnly && desc) {
          const ref = desc.replace('An ancient place, cited: ', '')
          html += `<div class="map-tooltip-fact">${esc(ref)}</div>`
        }
        html += `<span class="map-tooltip-badge map-tooltip-badge--sourced">${esc(e.source)}</span>`
        html += '</div>'
      }

      if (!popupRef.current) {
        popupRef.current = L.popup({ offset: [0, -4], closeButton: false })
      }
      popupRef.current.setLatLng([e.lat, e.lng]).setContent(`<span>${html}</span>`).openOn(map)
    },
    [knowledge, map],
  )
  const openPopupRef = useRef(openPopup)
  useEffect(() => {
    openPopupRef.current = openPopup
  }, [openPopup])

  const markersRef = useRef<L.CircleMarker[]>([])

  useEffect(() => {
    for (const m of markersRef.current) m.remove()
    markersRef.current = []

    const baseRadius = zoom >= 8 ? 5 : zoom >= 7 ? 4 : zoom >= 5 ? 3 : 2

    for (const e of visible) {
      const itemFill =
        colorField && colorMap ? (colorMap[getField(e, colorField)] ?? defaultFill) : defaultFill

      const marker = L.circleMarker([e.lat, e.lng], {
        radius: baseRadius,
        color: strokeColor,
        weight: 0.5,
        fillColor: itemFill,
        fillOpacity: 0.7,
        bubblingMouseEvents: false,
      })
      marker.on('click', () => openPopupRef.current(e))
      marker.addTo(map)
      markersRef.current.push(marker)
    }
  }, [visible, zoom, map, strokeColor, defaultFill, colorField, colorMap])

  useEffect(() => {
    return () => {
      for (const m of markersRef.current) m.remove()
      markersRef.current = []
    }
  }, [])

  return null
}
