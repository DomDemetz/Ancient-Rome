import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import type { AtlasEntity } from '@/data/entities/atlas'
import type { DatasetConfig } from '@/data/datasetRegistry'
import { useMapViewport } from '@/hooks/useMapViewport'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { appendCrossRefTooltip, appendWikiTooltip, esc } from '@/lib/wiki-popup'
import { useWikiEnrichment } from '@/hooks/useWikiEnrichment'
import { formatYear } from '@/lib/geo'

/**
 * THE point-entity renderer (unified rework, 2026-07-10). One instance per
 * atlas kind toggle; every dot is a row of the canonical entity table, so a
 * real-world site appears exactly once. One popup path through the
 * knowledge store: vici survey points get the same depth as everything
 * else the moment knowledge exists for their entity.
 *
 * A toggle is explicit intent — someone who turns on Watchtowers must SEE
 * watchtowers at the current view (most kinds have no knowledge tier; a
 * z8 gate made their toggles look dead from the default z5). Density is
 * handled by viewport sampling, not zoom gates; only unnamed survey
 * texture still waits for street level.
 */
const TIER_MIN_ZOOM: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 10 }

function labelKind(raw: string): string {
  return raw.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

interface AtlasLayerProps {
  data: AtlasEntity[]
  config: DatasetConfig
}

function spatialSample<T extends { la: number; lo: number }>(items: T[], gridSize: number): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${Math.floor(item.la / gridSize)},${Math.floor(item.lo / gridSize)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** structural DARE nodes carry their place-node id in `d` — their
 *  knowledge lives in the places store, not the features store */
const NODE_KEY = /^(dare|pl|wd)-/

export function AtlasLayer({ data, config }: AtlasLayerProps) {
  const map = useMap()
  const { zoom, bounds } = useMapViewport()
  const knowledge = useWikiEnrichment('knowledge-features')
  const placeKnowledge = useWikiEnrichment('knowledge-places')
  const popupRef = useRef<L.Popup | null>(null)
  const currentYear = useTimelineStore((s) => s.currentYear)

  const visible = useMemo(() => {
    if (zoom < config.minZoom) return []

    const s = bounds.getSouth(),
      n = bounds.getNorth(),
      w = bounds.getWest(),
      e2 = bounds.getEast()
    let filtered = data.filter((e) => {
      if (zoom < Math.max(config.minZoom, TIER_MIN_ZOOM[e.t])) return false
      // attestation window; rows without dates are undated archaeology and
      // ride with their tier (texture appears only at survey zooms anyway)
      if (e.s != null && e.s !== 0 && e.s > currentYear) return false
      if (e.e != null && e.e !== 0 && e.e < currentYear) return false
      return e.la >= s && e.la <= n && e.lo >= w && e.lo <= e2
    })

    const maxSample = config.maxSample ?? 500
    if (zoom < 9 && filtered.length > maxSample) {
      // knowledge-bearing dots always survive sampling — the famous site
      // must not lose its dot to an anonymous neighbor in the same cell
      const gridSize = zoom <= 5 ? 1.0 : zoom <= 7 ? 0.2 : 0.05
      const t1 = filtered.filter((e) => e.t === 1)
      filtered = t1.concat(
        spatialSample(
          filtered.filter((e) => e.t !== 1),
          gridSize,
        ),
      )
    }

    return filtered
  }, [data, zoom, bounds, currentYear, config.minZoom, config.maxSample])

  const openPopup = useCallback(
    (e: AtlasEntity) => {
      let html = `<div class="map-tooltip-title">${e.n ? esc(e.n) : 'Unknown site'}</div>`
      const sub: string[] = []
      if (e.k && e.k !== 'other') sub.push(labelKind(e.k))
      if (e.st && e.st !== 'unknown' && e.st !== e.k) sub.push(labelKind(e.st))
      if (sub.length) {
        html += `<div class="map-tooltip-sub">${esc(sub.join(' · '))}</div>`
      }
      if (e.s != null && e.s !== 0) {
        const span =
          e.e != null && e.e !== 0 && e.e !== e.s
            ? `${formatYear(e.s)} – ${formatYear(e.e)}`
            : formatYear(e.s)
        html += `<div class="map-tooltip-detail">${span}</div>`
      }

      // one lookup path: entity id first, adjudicated detail key second;
      // node-keyed rows (structural DARE places) resolve via the places store
      const isNode = !!e.d && NODE_KEY.test(e.d)
      const store = isNode ? placeKnowledge : knowledge
      const layerName = isNode ? 'knowledge-places' : 'knowledge-features'
      const kEntry = (!isNode ? store?.[e.i] : undefined) ?? (e.d ? store?.[e.d] : undefined)
      const kKey = !isNode && store?.[e.i] ? e.i : (e.d ?? e.i)
      if (kEntry?.extract) {
        html = appendWikiTooltip(html, kKey, store, layerName)
      } else if (kEntry?.crossRef) {
        html = appendCrossRefTooltip(html, kEntry.crossRef, { crKey: kKey })
      } else if (e.d || e.t === 1) {
        html += `<div class="map-tooltip-wiki"><button class="map-tooltip-readmore" data-wiki-id="${esc(kKey)}" data-wiki-layer="${layerName}">Details</button></div>`
      }

      if (!popupRef.current) {
        popupRef.current = L.popup({ offset: [0, -4], closeButton: false })
      }
      popupRef.current.setLatLng([e.la, e.lo]).setContent(`<span>${html}</span>`).openOn(map)
    },
    [knowledge, placeKnowledge, map],
  )
  const openPopupRef = useRef(openPopup)
  useEffect(() => {
    openPopupRef.current = openPopup
  }, [openPopup])

  const markersRef = useRef<L.CircleMarker[]>([])

  useEffect(() => {
    for (const m of markersRef.current) m.remove()
    markersRef.current = []

    // grow with zoom: a 2px dot is a ~4px hit target (the Pompeii lesson)
    const baseRadius = zoom >= 14 ? 5 : zoom >= 11 ? 4 : zoom >= 8 ? 3.5 : zoom >= 6 ? 3 : 2

    for (const e of visible) {
      const marker = L.circleMarker([e.la, e.lo], {
        // texture dots recede; knowledge dots read as clickable
        radius: e.t === 3 ? baseRadius - 1 : baseRadius,
        color: e.t === 1 ? config.color : 'transparent',
        weight: e.t === 1 ? 1 : 0,
        fillColor: config.fillColor,
        fillOpacity: e.t === 3 ? 0.45 : 0.7,
        bubblingMouseEvents: false,
      })
      if (e.n) {
        marker.bindTooltip(esc(e.n), {
          direction: 'top',
          offset: [0, -baseRadius],
          className: 'name-tooltip',
        })
      }
      marker.on('mouseover', () => marker.setRadius(baseRadius + 2))
      marker.on('mouseout', () => marker.setRadius(e.t === 3 ? baseRadius - 1 : baseRadius))
      marker.on('click', () => openPopupRef.current(e))
      marker.addTo(map)
      markersRef.current.push(marker)
    }
  }, [visible, zoom, map, config.color, config.fillColor])

  useEffect(() => {
    return () => {
      for (const m of markersRef.current) m.remove()
      markersRef.current = []
    }
  }, [])

  return null
}
