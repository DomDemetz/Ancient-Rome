import { useMemo, useState, useCallback } from 'react'
import { CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet'
import type { Building } from '@/data/buildings'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useWikiEnrichment } from '@/hooks/useWikiEnrichment'
import { appendWikiTooltip, esc } from '@/lib/wiki-popup'

interface BuildingsLayerProps {
  data: Building[]
}

const BUILDING_COLORS: Record<string, string> = {
  temple: '#f0c040',
  theater: '#e74c3c',
  bath: '#3498db',
  forum: '#d4af37',
  circus: '#e67e22',
  basilica: '#9b59b6',
  arch: '#c0392b',
  column: '#bdc3c7',
  palace: '#8e44ad',
  library: '#2ecc71',
  amphitheater: '#d4a574',
  bridge: '#6baed6',
  aqueduct: '#3498db',
  nymphaeum: '#2ecc71',
}

// Building types shown at each zoom tier
const TIER1_TYPES = new Set(['forum', 'circus', 'palace', 'library', 'column'])
const TIER2_TYPES = new Set([
  'forum',
  'circus',
  'palace',
  'library',
  'column',
  'theater',
  'bath',
  'amphitheater',
])

function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year)} BC`
  return `${year} AD`
}

export function BuildingsLayer({ data }: BuildingsLayerProps) {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())
  const [bounds, setBounds] = useState(map.getBounds())
  const currentYear = useTimelineStore((s) => s.currentYear)
  const wikiLookup = useWikiEnrichment('buildings')

  const updateView = useCallback(() => {
    setZoom(map.getZoom())
    setBounds(map.getBounds())
  }, [map])

  useMapEvents({
    zoomend: updateView,
    moveend: updateView,
  })

  const visible = useMemo(() => {
    return data.filter((b) => {
      if (b.constructionYear != null && b.constructionYear > currentYear) return false

      // Progressive disclosure: 3 tiers
      if (zoom < 6) return false
      if (zoom < 7 && !TIER1_TYPES.has(b.buildingType)) return false
      if (zoom < 8 && !TIER2_TYPES.has(b.buildingType)) return false

      // Bounds filtering
      if (zoom >= 7) {
        return (
          b.lat >= bounds.getSouth() &&
          b.lat <= bounds.getNorth() &&
          b.lng >= bounds.getWest() &&
          b.lng <= bounds.getEast()
        )
      }
      return true
    })
  }, [data, zoom, bounds, currentYear])

  const baseRadius = zoom >= 9 ? 5 : zoom >= 7 ? 4 : 3

  return (
    <>
      {visible.map((b) => {
        const color = BUILDING_COLORS[b.buildingType] || '#95a5a6'

        let tooltipHtml = `<div class="map-tooltip-title">${esc(b.name)}</div>`
        tooltipHtml += `<div class="map-tooltip-sub">${esc(b.buildingType.charAt(0).toUpperCase() + b.buildingType.slice(1))}</div>`
        const details: string[] = [`Built: ${formatYear(b.constructionYear)}`]
        if (b.builder) details.push(esc(b.builder))
        if (b.description) details.push(esc(b.description))
        tooltipHtml += `<div class="map-tooltip-detail">${details.join(' · ')}</div>`

        return (
          <CircleMarker
            key={b.id}
            center={[b.lat, b.lng]}
            radius={baseRadius}
            pathOptions={{
              color: '#2c3e50',
              weight: 1,
              fillColor: color,
              fillOpacity: 0.85,
            }}
            bubblingMouseEvents={false}
          >
            <Popup key={wikiLookup ? 'w' : 'p'} offset={[0, -4]} closeButton={false}>
              <span
                dangerouslySetInnerHTML={{
                  __html: appendWikiTooltip(tooltipHtml, b.id, wikiLookup, 'buildings'),
                }}
              />
            </Popup>
          </CircleMarker>
        )
      })}
    </>
  )
}
