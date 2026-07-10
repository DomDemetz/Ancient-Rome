import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import type { Building } from '@/data/buildings'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useWikiEnrichment } from '@/hooks/useWikiEnrichment'
import { appendWikiTooltip, appendCrossRefTooltip, esc } from '@/lib/wiki-popup'
import { formatYear } from '@/lib/geo'
import { useMapViewport } from '@/hooks/useMapViewport'

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
  villa: '#27ae60',
  monument: '#95a5a6',
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

export function BuildingsLayer({ data }: BuildingsLayerProps) {
  const map = useMap()
  const { zoom, bounds } = useMapViewport()
  const currentYear = useTimelineStore((s) => s.currentYear)
  const featKnowledge = useWikiEnrichment('knowledge-features')
  const popupRef = useRef<L.Popup | null>(null)

  const visible = useMemo(() => {
    const s = bounds.getSouth(),
      n = bounds.getNorth(),
      w = bounds.getWest(),
      e = bounds.getEast()
    return data.filter((b) => {
      if (b.constructionYear != null && b.constructionYear > currentYear) return false
      // attestedTo is only a period end, but destroyedYear is a real event
      // (Vesuvius): the Stabian Baths must not dot the map in 1000 AD
      if (b.destroyedYear != null && b.destroyedYear < currentYear) return false
      if (zoom < 6) return false
      if (zoom < 7 && !TIER1_TYPES.has(b.buildingType)) return false
      if (zoom < 8 && !TIER2_TYPES.has(b.buildingType)) return false
      return b.lat >= s && b.lat <= n && b.lng >= w && b.lng <= e
    })
  }, [data, zoom, bounds, currentYear])

  const openPopup = useCallback(
    (b: Building) => {
      let html = `<div class="map-tooltip-title">${esc(b.name)}</div>`
      html += `<div class="map-tooltip-sub">${esc(b.buildingType.charAt(0).toUpperCase() + b.buildingType.slice(1))}</div>`
      const details: string[] = [`Built: ${formatYear(b.constructionYear)}`]
      if (b.builder) details.push(esc(b.builder))
      const hasWiki = featKnowledge?.[`building:${b.id}`]
      if (b.description && !hasWiki) details.push(esc(b.description))
      html += `<div class="map-tooltip-detail">${details.join(' · ')}</div>`
      html = appendWikiTooltip(html, `building:${b.id}`, featKnowledge, 'knowledge-features')
      if (!hasWiki) {
        const crKey = `building:${b.id}`
        const crEntry = featKnowledge?.[crKey]?.crossRef
        if (crEntry) html = appendCrossRefTooltip(html, crEntry, { crKey })
      }

      if (!popupRef.current) {
        popupRef.current = L.popup({ offset: [0, -4], closeButton: false })
      }
      popupRef.current.setLatLng([b.lat, b.lng]).setContent(`<span>${html}</span>`).openOn(map)
    },
    [featKnowledge, map],
  )
  const openPopupRef = useRef(openPopup)
  useEffect(() => {
    openPopupRef.current = openPopup
  }, [openPopup])

  const markersRef = useRef<L.CircleMarker[]>([])

  useEffect(() => {
    for (const m of markersRef.current) m.remove()
    markersRef.current = []

    const baseRadius = zoom >= 9 ? 5 : zoom >= 7 ? 4 : 3

    for (const b of visible) {
      const color = BUILDING_COLORS[b.buildingType] || '#95a5a6'
      const marker = L.circleMarker([b.lat, b.lng], {
        radius: baseRadius,
        color: '#2c3e50',
        weight: 1,
        fillColor: color,
        fillOpacity: 0.85,
        bubblingMouseEvents: false,
      })
      marker.bindTooltip(esc(b.name), {
        direction: 'top',
        offset: [0, -baseRadius],
        className: 'name-tooltip',
      })
      marker.on('mouseover', () => marker.setRadius(baseRadius + 2))
      marker.on('mouseout', () => marker.setRadius(baseRadius))
      marker.on('click', () => openPopupRef.current(b))
      marker.addTo(map)
      markersRef.current.push(marker)
    }
  }, [visible, zoom, map])

  useEffect(() => {
    return () => {
      for (const m of markersRef.current) m.remove()
      markersRef.current = []
    }
  }, [])

  return null
}
