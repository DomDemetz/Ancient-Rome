import { useMemo } from 'react'
import { CircleMarker, Popup, Tooltip } from 'react-leaflet'
import type { PlaceNode, PlacePopulationPoint } from '@/data/places'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useWikiEnrichment, useCrossRef } from '@/hooks/useWikiEnrichment'
import { appendWikiTooltip, appendCrossRefTooltip, esc } from '@/lib/wiki-popup'
import { DARE_TYPE_TO_CATEGORY, getSettlementStyle } from './settlementStyles'
import { useMapViewport } from '@/hooks/useMapViewport'
import { baseTooltipHtml, displayName } from './placeTooltip'

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


/**
 * THE canonical place layer — renders the merged entity nodes (DARE +
 * Chandler + Pleiades + Wikidata, one node per real place; ENTITY-MODEL.md).
 * Population nodes render amber, sized by their interpolated population, and
 * carry zoom-aware labels; DARE-typed nodes keep the category legend styling.
 */
export function PlacesLayer({
  data,
  enabledTypes,
  hiddenCategories,
  showSettlements,
  showCities,
}: PlacesLayerProps) {
  const { zoom, bounds } = useMapViewport()
  const currentYear = useTimelineStore((s) => s.currentYear)
  const setlWiki = useWikiEnrichment('settlements')
  const crossRef = useCrossRef()

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
      // via their own curves.
      if (!hasPop && p.endYear === 0 && currentYear > 800) return false
      // Territory-correlated undated settlements: visible 20y after control
      if (p.startYear === 0 && p.dare?.territoryYear != null) {
        if (currentYear < p.dare.territoryYear + 20) return false
        if (p.dare.declineYear != null && currentYear > p.dare.declineYear + 50) return false
      }

      // Zoom rules: population nodes always visible; DARE nodes by type;
      // gazetteer-only (minor) nodes appear from zoom 8 like small settlements
      if (!hasPop && t != null && zoom < getZoomThreshold(t, p.dare?.major ?? false)) return false
      if (!hasPop && t == null && zoom < 8) return false

      // Bounds filtering at zoomed-in levels
      if (zoom >= 7) {
        return (
          p.lat >= bounds.getSouth() &&
          p.lat <= bounds.getNorth() &&
          p.lng >= bounds.getWest() &&
          p.lng <= bounds.getEast()
        )
      }
      return true
    })
  }, [data, zoom, bounds, currentYear, enabledTypes, hiddenCategories, showSettlements, showCities])

  return (
    <>
      {visible.map((p) => {
        const pop = showCities && p.populations ? popAt(p.populations, currentYear) : null
        const name = displayName(p, currentYear)

        let color: string
        let radius: number
        let weight: number
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
          radius = style.radius
          weight = 0.5
        }

        const wikiLookup = setlWiki
        const wikiKey = p.wiki?.[1] ?? ''
        const wikiLayer = p.wiki?.[0] ?? 'settlements'
        const hasWiki = p.wiki && wikiLookup?.[wikiKey]
        const crEntry =
          !hasWiki && crossRef
            ? (p.dare?.id && crossRef[`settlement:${p.dare.id}`]) ||
              (p.pid && crossRef[`pleiades:${p.pid}`]) ||
              null
            : null

        let popupHtml = appendWikiTooltip(
          baseTooltipHtml(p, name, pop, currentYear),
          wikiKey,
          p.wiki ? wikiLookup : null,
          wikiLayer,
          p.entity,
        )
        if (crEntry) {
          const crKey =
            (p.dare?.id && crossRef![`settlement:${p.dare.id}`] ? `settlement:${p.dare.id}` : '') ||
            (p.pid && crossRef![`pleiades:${p.pid}`] ? `pleiades:${p.pid}` : '')
          popupHtml = appendCrossRefTooltip(
            popupHtml,
            crEntry,
            crKey ? { crKey, pid: p.pid, qid: p.qid } : undefined,
          )
        }
        if (!hasWiki && !crEntry && (p.qid || p.pid)) {
          const links: string[] = []
          if (p.pid)
            links.push(
              `<a href="https://pleiades.stoa.org/places/${esc(p.pid)}" target="_blank" rel="noopener noreferrer">Pleiades ↗</a>`,
            )
          if (p.qid)
            links.push(
              `<a href="https://www.wikidata.org/wiki/${esc(p.qid)}" target="_blank" rel="noopener noreferrer">Wikidata ↗</a>`,
            )
          popupHtml += `<div class="map-tooltip-detail">${links.join(' · ')}</div>`
        }

        return (
          <CircleMarker
            key={`${p.id}-${pop != null ? 'c' : 's'}`}
            center={[p.lat, p.lng]}
            radius={radius}
            pathOptions={{
              color: pop != null && pop > 0 ? '#fcd34d' : color,
              fillColor: color,
              fillOpacity: 0.8,
              weight,
            }}
            bubblingMouseEvents={false}
          >
            {pop != null && pop >= labelMinPop(zoom) && (
              <Tooltip permanent direction="top" className="city-label" offset={[0, -radius - 1]}>
                {name}
              </Tooltip>
            )}
            <Popup key={wikiLookup ? 'w' : 'p'} offset={[0, -4]} closeButton={false}>
              <span dangerouslySetInnerHTML={{ __html: popupHtml }} />
            </Popup>
          </CircleMarker>
        )
      })}
    </>
  )
}
