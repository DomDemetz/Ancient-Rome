import { useEffect, useMemo } from 'react'
import { CircleMarker, Popup, Tooltip } from 'react-leaflet'
import type { PlaceNode, PlacePopulationPoint } from '@/data/places'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { useWikiEnrichment } from '@/hooks/useWikiEnrichment'
import { appendWikiTooltip, esc } from '@/lib/wiki-popup'
import {
  DARE_TYPE_LABELS,
  DARE_TYPE_TO_CATEGORY,
  CATEGORY_STYLES,
  getSettlementStyle,
} from './settlementStyles'
import { formatYear } from '@/lib/geo'
import { useMapViewport } from '@/hooks/useMapViewport'

interface PlacesLayerProps {
  data: PlaceNode[]
  enabledTypes: Set<number>
  hiddenCategories: Set<string>
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

function fmtPop(pop: number): string {
  if (pop >= 1000000) return `${(pop / 1000000).toFixed(1)}M`
  if (pop >= 1000) return `${Math.round(pop / 1000)}K`
  return String(pop)
}

/** Period-correct display name for the handful of famous renames. */
function displayName(p: PlaceNode, year: number): string {
  if (p.name === 'Constantinople' && year < 330) return 'Byzantium'
  return p.name
}

function baseTooltipHtml(p: PlaceNode, name: string, pop: number | null, year: number): string {
  let html = `<div class="map-tooltip-title">${esc(name)}</div>`
  const sub: string[] = []
  if (p.modern && p.modern !== name) sub.push(esc(p.modern))
  if (sub.length) html += `<div class="map-tooltip-sub">${sub.join(' · ')}</div>`

  const t = p.dare?.type
  const typeLabel = t != null ? DARE_TYPE_LABELS[t] : null
  const category = t != null ? DARE_TYPE_TO_CATEGORY[t] : null
  const categoryLabel = category ? CATEGORY_STYLES[category].label : null
  const details: string[] = []
  const typeParts = [typeLabel, categoryLabel].filter(Boolean).join(' · ')
  if (typeParts) details.push(typeParts)
  if (pop != null && pop > 0) details.push(`Pop: ~${fmtPop(pop)}`)
  if (p.startYear !== 0 || p.endYear !== 0) {
    const start = p.startYear !== 0 ? formatYear(p.startYear) : '?'
    const end = p.endYear !== 0 ? formatYear(Math.min(p.endYear, 1453)) : '?'
    details.push(`${start} – ${end}`)
  }
  if (p.vici?.length)
    details.push(`${p.vici.length} archaeological site${p.vici.length > 1 ? 's' : ''}`)
  if (details.length) html += `<div class="map-tooltip-detail">${details.join(' · ')}</div>`
  if (year >= 0 && pop != null && pop > 0) {
    // population is the one time-varying fact; date it
    html = html.replace(`Pop: ~${fmtPop(pop)}`, `Pop: ~${fmtPop(pop)} (${year} AD)`)
  }
  return html
}

/**
 * THE canonical place layer — renders the merged entity nodes (DARE +
 * Chandler + Pleiades + Wikidata, one node per real place; ENTITY-MODEL.md).
 * Population nodes render amber, sized by their interpolated population, and
 * carry zoom-aware labels; DARE-typed nodes keep the category legend styling.
 */
/** Capture-phase click delegate for the "connections" button in node popups —
 *  opens the curated narrative graph (DetailPanel) for absorbed entities. */
function useConnectionsDelegate() {
  const select = useSelectionStore((s) => s.select)
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const btn = (e.target as HTMLElement).closest(
        '.map-tooltip-connections',
      ) as HTMLElement | null
      if (btn?.dataset.entityId) select(btn.dataset.entityId)
    }
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [select])
}

export function PlacesLayer({ data, enabledTypes, hiddenCategories }: PlacesLayerProps) {
  useConnectionsDelegate()
  const { zoom, bounds } = useMapViewport()
  const currentYear = useTimelineStore((s) => s.currentYear)
  const setlWiki = useWikiEnrichment('settlements')
  const citiesWiki = useWikiEnrichment('cities')

  const visible = useMemo(() => {
    return data.filter((p) => {
      const hasPop = p.populations != null && p.populations.length > 0
      const t = p.dare?.type

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
  }, [data, zoom, bounds, currentYear, enabledTypes, hiddenCategories])

  return (
    <>
      {visible.map((p) => {
        const pop = p.populations ? popAt(p.populations, currentYear) : null
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

        const wikiLookup = p.wiki?.[0] === 'cities' ? citiesWiki : setlWiki
        const wikiKey = p.wiki?.[1] ?? ''
        const wikiLayer = p.wiki?.[0] ?? 'settlements'

        return (
          <CircleMarker
            key={p.id}
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
              <span
                dangerouslySetInnerHTML={{
                  __html:
                    appendWikiTooltip(
                      baseTooltipHtml(p, name, pop, currentYear),
                      wikiKey,
                      p.wiki ? wikiLookup : null,
                      wikiLayer,
                    ) +
                    (p.entity
                      ? `<button class="map-tooltip-readmore map-tooltip-connections" data-entity-id="${p.entity}">Explore ${p.entityConnections ?? ''} connection${p.entityConnections === 1 ? '' : 's'}</button>`
                      : '') +
                    (p.qid && !(p.wiki && wikiLookup?.[wikiKey])
                      ? `<div class="map-tooltip-detail"><a href="https://www.wikidata.org/wiki/${p.qid}" target="_blank" rel="noopener noreferrer">Wikidata ↗</a></div>`
                      : ''),
                }}
              />
            </Popup>
          </CircleMarker>
        )
      })}
    </>
  )
}
