import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import type { PlaceNode, PlacePopulationPoint } from '@/data/places'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useWikiEnrichment } from '@/hooks/useWikiEnrichment'
import { appendWikiTooltip, appendCrossRefTooltip, esc } from '@/lib/wiki-popup'
import { DARE_TYPE_TO_CATEGORY, getSettlementStyle } from './settlementStyles'
import { useMapViewport } from '@/hooks/useMapViewport'
import { baseTooltipHtml, displayName } from './placeTooltip'
import empiresSearchJson from '@/data/registry/empires-search.json'
import { imperialAnchors } from './imperialAnchors'
import { labelProjector } from './labelCollision'

interface PlacesLayerProps {
  data: PlaceNode[]
  enabledTypes: Set<number>
  hiddenCategories: Set<string>
  /** the DARE-typed settlement dots */
  showSettlements: boolean
  /** the amber population cities (sized + labeled) */
  showCities: boolean
}

/** Zoom threshold below which a DARE-typed place is hidden (ported 1:1). */
function getZoomThreshold(type: number, major: boolean): number {
  if (major || type === 11) return 6
  if (type === 17) return 6
  if ([12, 13, 18, 35].includes(type)) return 8
  if ([31, 61, 19, 43].includes(type)) return 9
  return 10
}

/** Only the biggest cities get a permanent label when zoomed out. */
function labelMinPop(zoom: number): number {
  if (zoom <= 4) return 250000
  if (zoom === 5) return 120000
  if (zoom === 6) return 60000
  if (zoom === 7) return 25000
  return 0
}

function populationAt(points: PlacePopulationPoint[], year: number): number | null {
  if (points.length === 0) return null
  if (year <= points[0].year) return points[0].population
  if (year >= points[points.length - 1].year) return points[points.length - 1].population
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (year >= a.year && year <= b.year) {
      const span = b.year - a.year
      if (span === 0) return a.population
      const t = (year - a.year) / span
      return Math.round(a.population + t * (b.population - a.population))
    }
  }
  return null
}

function popAt(points: PlacePopulationPoint[], year: number): number | null {
  if (points.length === 0) return null
  // No extrapolation: outside the attested curve the node falls back to its
  // DARE styling. (Clamping made Baghdad "populated" in 117 AD — the merged
  // node inherits DARE's wide span, but its curve only starts in 763.)
  if (year < points[0].year || year > points[points.length - 1].year) return null
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (year >= a.year && year <= b.year) {
      const span = b.year - a.year
      if (span === 0) return a.population
      const t = (year - a.year) / span
      return Math.round(a.population + t * (b.population - a.population))
    }
  }
  return null
}

function popRadius(pop: number): number {
  if (pop >= 400000) return 11
  if (pop >= 200000) return 9
  if (pop >= 100000) return 7
  if (pop >= 50000) return 5.5
  if (pop >= 20000) return 4.5
  return 3.5
}

interface MarkerEntry {
  marker: L.CircleMarker
  tooltipKey: string | null
}

/**
 * THE canonical place layer — renders the merged entity nodes (DARE +
 * Chandler + Pleiades + Wikidata, one node per real place; ENTITY-MODEL.md).
 *
 * All markers are managed imperatively via Leaflet's L.circleMarker — no
 * React elements for circles or tooltips. A diff against the previous
 * visible set avoids rebuilding unchanged markers during timeline scrubs.
 */
export function PlacesLayer({
  data,
  enabledTypes,
  hiddenCategories,
  showSettlements,
  showCities,
}: PlacesLayerProps) {
  const map = useMap()
  const { zoom, bounds } = useMapViewport()
  const currentYear = useTimelineStore((s) => s.currentYear)
  const knowledge = useWikiEnrichment('knowledge-places')
  const sharedPopupRef = useRef<L.Popup | null>(null)

  const openPopup = useCallback(
    (p: PlaceNode) => {
      const pop = showCities && p.populations ? popAt(p.populations, currentYear) : null
      const name = displayName(p, currentYear)
      const k = knowledge?.[p.id]
      const hasWiki = !!k?.extract
      let html = appendWikiTooltip(
        baseTooltipHtml(p, name, pop, currentYear),
        p.id,
        hasWiki ? knowledge : null,
        'knowledge-places',
        p.entity,
      )
      if (!hasWiki && k?.crossRef) {
        html = appendCrossRefTooltip(html, k.crossRef, {
          crKey: p.id,
          pid: p.pid,
          qid: p.qid,
        })
      }
      if (!k && (p.qid || p.pid || p.id.startsWith('wd-'))) {
        const detailId = p.pid
          ? `pleiades:${p.pid}`
          : p.id.startsWith('wd-')
            ? p.id
            : `settlement:${p.id}`
        html += `<button class="map-tooltip-readmore" data-wiki-id="${esc(detailId)}" data-wiki-layer="crossref">Read more</button>`
      }
      if (!sharedPopupRef.current) {
        sharedPopupRef.current = L.popup({ offset: [0, -4], closeButton: false })
      }
      sharedPopupRef.current
        .setLatLng([p.lat, p.lng])
        .setContent(`<span>${html}</span>`)
        .openOn(map)
    },
    [knowledge, currentYear, showCities, map],
  )
  const openPopupRef = useRef(openPopup)
  useEffect(() => {
    openPopupRef.current = openPopup
  }, [openPopup])

  const visible = useMemo(() => {
    return data.filter((p) => {
      // A population city counts as one only while the Cities toggle is on;
      // otherwise it degrades to (or hides with) its settlement identity.
      const hasPop = showCities && p.populations != null && p.populations.length > 0
      const t = p.dare?.type
      if (!hasPop && !showSettlements) return false

      // Category/type filters apply to DARE-typed nodes; population nodes
      // (major cities) obey the urban category toggle
      if (t != null) {
        if (!enabledTypes.has(t) && !hasPop) return false
        const category = DARE_TYPE_TO_CATEGORY[t]
        if (category && hiddenCategories.has(category)) return false
      } else if (hiddenCategories.has('urban')) {
        return false
      }

      // Timeline filtering (0 = unknown, DARE semantics)
      if (p.startYear !== 0 && p.startYear > currentYear) return false
      if (p.endYear !== 0 && p.endYear < currentYear) return false
      // Unknown end ≠ immortal: DARE-only nodes without an attested end stop
      // at the archaeological data horizon (~800); population nodes carry on
      // via their own curves. Wikidata-sourced places (wd-*) persist.
      if (!hasPop && p.endYear === 0 && currentYear > 800 && !!p.dare) return false
      // Territory-correlated undated settlements: visible 20y after control
      if (p.startYear === 0 && p.dare?.territoryYear != null) {
        if (currentYear < p.dare.territoryYear + 20) return false
        if (p.dare.declineYear != null && currentYear > p.dare.declineYear + 50) return false
      }

      // Dot discipline at empire zooms: an unlabeled dot is noise. Below
      // zoom 6, a population node renders only if it earns a label at the
      // CURRENT year (ghost-dots from off-curve years included).
      if (hasPop && zoom <= 5) {
        const cur = popAt(p.populations!, currentYear)
        if (cur == null || cur < (zoom <= 4 ? 250000 : 120000)) return false
      }

      // Zoom rules: population nodes always visible; DARE nodes by type;
      // gazetteer-only (minor) nodes appear from zoom 8 like small settlements
      if (!hasPop && t != null && zoom < getZoomThreshold(t, p.dare?.major ?? false)) return false
      if (!hasPop && t == null && zoom < 8) return false

      // Bounds filtering — cheap early-out at every zoom; at low zooms most
      // markers pass anyway, but it cuts East-Asian/American stragglers that
      // survived the zoom-threshold filter
      return (
        p.lat >= bounds.getSouth() &&
        p.lat <= bounds.getNorth() &&
        p.lng >= bounds.getWest() &&
        p.lng <= bounds.getEast()
      )
    })
  }, [data, zoom, bounds, currentYear, enabledTypes, hiddenCategories, showSettlements, showCities])

  // Minor-name declutter (same greedy rule as empire labels): each name
  // claims ~84x18px; later claimants in occupied space stay anonymous.
  // Priority: knowledge-bearing nodes first, then stable by id.
  const minorLabelIds = useMemo(() => {
    if (zoom < 7) return new Set<string>()
    const { x: mercX, y: mercY } = labelProjector(zoom)
    const candidates = visible
      .filter((p) => p.dare?.major && !(p.populations && p.populations.length))
      .sort((a, b) => {
        const ka = (a.wiki ? 2 : 0) + (a.vici ? 1 : 0)
        const kb = (b.wiki ? 2 : 0) + (b.vici ? 1 : 0)
        return kb - ka || a.id.localeCompare(b.id)
      })
    const placed: Array<[number, number]> = []
    // empire-name anchors are obstacles: a minor name under ROMAN EMPIRE
    // is unreadable both ways
    for (const em of empiresSearchJson as Array<{
      lat: number
      lng: number
      s: number
      e: number
    }>) {
      if (em.s <= currentYear && em.e >= currentYear) {
        placed.push([mercX(em.lng), mercY(em.lat)])
      }
    }
    // Rome/Byzantium name themselves from the territory layer (not in the
    // empires manifest) — shared anchors (imperialAnchors.ts). Vast-tier
    // names run ~200px wide: claim a spread, not a point (Venusia printed
    // through the tail of ROMAN EMPIRE)
    for (const [alat, alng] of imperialAnchors(currentYear)) {
      for (const dx of [-99, 0, 99]) {
        placed.push([mercX(alng) + dx, mercY(alat)])
      }
    }
    // labeled population cities are obstacles too — Alsium was printing
    // straight through 'Rome'
    for (const p of visible) {
      if (!p.populations?.length) continue
      const cur = populationAt(p.populations, currentYear)
      if (cur != null && cur >= labelMinPop(zoom)) {
        placed.push([mercX(p.lng), mercY(p.lat)])
      }
    }
    const out = new Set<string>()
    for (const p of candidates) {
      const x = mercX(p.lng)
      const y = mercY(p.lat)
      if (placed.some(([px, py]) => Math.abs(px - x) < 84 && Math.abs(py - y) < 18)) continue
      placed.push([x, y])
      out.add(p.id)
    }
    return out
  }, [visible, zoom, currentYear])

  // City labels also declutter among themselves: Cairo grows next door to
  // Memphis and at empire zoom both printed on top of each other. Bigger
  // population claims the space; the loser keeps its dot and tooltip.
  const cityLabelIds = useMemo(() => {
    const { x: mercX, y: mercY } = labelProjector(zoom)
    if (zoom >= 7) {
      // enough room between cities when zoomed in — but the imperial name
      // still owns its anchor (Venusia printed under ROMAN EMPIRE at z7)
      const anchors = imperialAnchors(currentYear).map(
        ([alat, alng]) => [mercX(alng), mercY(alat)] as const,
      )
      const out = new Set<string>()
      for (const p of visible) {
        const x = mercX(p.lng)
        const y = mercY(p.lat)
        if (anchors.some(([ax, ay]) => Math.abs(ax - x) < 130 && Math.abs(ay - y) < 22)) continue
        out.add(p.id)
      }
      return out
    }
    const min = labelMinPop(zoom)
    const labeled = visible
      .map((p) => ({ p, pop: p.populations ? populationAt(p.populations, currentYear) : null }))
      .filter(
        (x): x is { p: (typeof visible)[number]; pop: number } => x.pop != null && x.pop >= min,
      )
      .sort((a, b) => b.pop - a.pop || a.p.id.localeCompare(b.p.id))
    const placed: Array<[number, number]> = []
    const out = new Set<string>()
    for (const { p } of labeled) {
      const x = mercX(p.lng)
      const y = mercY(p.lat)
      // tight box: only true stacking (Cairo grows ~5px from Memphis) —
      // neighbors like Gallipoli/Constantinople (~43px) both keep names
      if (placed.some(([px, py]) => Math.abs(px - x) < 40 && Math.abs(py - y) < 14)) continue
      placed.push([x, y])
      out.add(p.id)
    }
    return out
  }, [visible, zoom, currentYear])

  // --- imperative marker management (diff against previous visible set) ---
  const markersRef = useRef(new Map<string, MarkerEntry>())

  useEffect(() => {
    const entries = markersRef.current
    const nextIds = new Set<string>()

    for (const p of visible) {
      nextIds.add(p.id)

      const pop = showCities && p.populations ? popAt(p.populations, currentYear) : null
      const name = displayName(p, currentYear)

      let color: string
      let radius: number
      let weight: number
      const isGazetteer = (pop == null || pop <= 0) && p.dare?.type == null
      if (pop != null && pop > 0) {
        color = '#f59e0b'
        radius = popRadius(pop)
        weight = 1
      } else {
        const style = getSettlementStyle(
          p.dare?.type ?? (p.minor ? 12 : 11),
          p.dare?.major ?? false,
          zoom,
        )
        color = style.color
        radius = isGazetteer ? Math.max(1.5, style.radius - 1) : style.radius
        weight = 0.5
      }

      const strokeColor = pop != null && pop > 0 ? '#fcd34d' : color
      const fillOpacity = isGazetteer ? 0.45 : 0.8

      const hasLabel =
        (pop != null &&
          pop >= labelMinPop(zoom) &&
          (cityLabelIds == null || cityLabelIds.has(p.id))) ||
        minorLabelIds.has(p.id)
      const isCity = pop != null && pop >= labelMinPop(zoom)
      const tooltipKey = hasLabel ? `${name}|${isCity ? 'c' : 'm'}` : null

      const existing = entries.get(p.id)
      if (existing) {
        existing.marker.setRadius(radius)
        existing.marker.setStyle({ color: strokeColor, fillColor: color, fillOpacity, weight })
        if (tooltipKey !== existing.tooltipKey) {
          if (existing.tooltipKey != null) existing.marker.unbindTooltip()
          if (hasLabel) {
            existing.marker.bindTooltip(name, {
              permanent: true,
              direction: 'top',
              className: isCity ? 'city-label' : 'city-label city-label--minor',
              offset: [0, -radius - 1],
            })
          }
          existing.tooltipKey = tooltipKey
        }
      } else {
        const marker = L.circleMarker([p.lat, p.lng], {
          radius,
          color: strokeColor,
          fillColor: color,
          fillOpacity,
          weight,
          bubblingMouseEvents: false,
        })
        marker.on('click', () => openPopupRef.current(p))
        if (hasLabel) {
          marker.bindTooltip(name, {
            permanent: true,
            direction: 'top',
            className: isCity ? 'city-label' : 'city-label city-label--minor',
            offset: [0, -radius - 1],
          })
        }
        marker.addTo(map)
        entries.set(p.id, { marker, tooltipKey })
      }
    }

    for (const [id, entry] of entries) {
      if (!nextIds.has(id)) {
        entry.marker.remove()
        entries.delete(id)
      }
    }
  }, [visible, minorLabelIds, cityLabelIds, currentYear, showCities, zoom, map])

  useEffect(() => {
    return () => {
      for (const entry of markersRef.current.values()) entry.marker.remove()
      markersRef.current.clear()
    }
  }, [])

  return null
}
