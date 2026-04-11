import { useMemo } from 'react'
import { CircleMarker, Popup } from 'react-leaflet'
import type { DareSettlement, CityPopulation } from '@/data/dare'
import { useTimelineStore } from '@/stores/useTimelineStore'
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

interface SettlementLayerProps {
  data: DareSettlement[]
  enabledTypes: Set<number>
  hiddenCategories: Set<string>
  populationData?: CityPopulation[] | null
}

function getZoomThreshold(type: number, major: boolean): number {
  if (major || type === 11) return 6
  if (type === 17) return 6
  if ([12, 13, 18, 35].includes(type)) return 8
  if ([31, 61, 19, 43].includes(type)) return 9
  return 10
}

function formatPopulation(pop: number): string {
  if (pop >= 1000000) return `${(pop / 1000000).toFixed(1)}M`
  if (pop >= 1000) return `${(pop / 1000).toFixed(0)}K`
  return String(pop)
}

// Interpolate population at a given year from population data points
function interpolatePopulation(
  pops: { year: number; population: number }[],
  year: number,
): number | null {
  if (pops.length === 0) return null

  // Before earliest data point
  if (year <= pops[0].year) return pops[0].population
  // After latest data point
  if (year >= pops[pops.length - 1].year) return pops[pops.length - 1].population

  // Find bracketing points and interpolate
  for (let i = 0; i < pops.length - 1; i++) {
    if (year >= pops[i].year && year <= pops[i + 1].year) {
      const span = pops[i + 1].year - pops[i].year
      if (span === 0) return pops[i].population
      const t = (year - pops[i].year) / span
      return Math.round(pops[i].population + t * (pops[i + 1].population - pops[i].population))
    }
  }
  return null
}

// Map population to a circle radius
function populationRadius(pop: number, zoom: number): number {
  const base = zoom >= 7 ? 1.2 : 1
  if (pop >= 500000) return base * 10
  if (pop >= 200000) return base * 8
  if (pop >= 100000) return base * 6.5
  if (pop >= 50000) return base * 5
  if (pop >= 20000) return base * 4
  if (pop >= 10000) return base * 3.5
  return base * 3
}

function buildTooltipHtml(s: DareSettlement, population?: number | null): string {
  let html = `<div class="map-tooltip-title">${esc(s.name)}</div>`

  const sub: string[] = []
  if (s.modern && s.modern !== s.name) sub.push(esc(s.modern))
  if (s.greek) sub.push(esc(s.greek))
  if (sub.length) html += `<div class="map-tooltip-sub">${sub.join(' · ')}</div>`

  const typeLabel = DARE_TYPE_LABELS[s.type]
  const category = DARE_TYPE_TO_CATEGORY[s.type]
  const categoryLabel = category ? CATEGORY_STYLES[category].label : null
  const typeParts = [typeLabel, categoryLabel].filter(Boolean).join(' · ')

  const details: string[] = []
  if (typeParts) details.push(typeParts)
  if (population != null && population > 0) details.push(`Pop: ~${formatPopulation(population)}`)
  if (s.startYear !== 0 || s.endYear !== 0) {
    const start = s.startYear !== 0 ? formatYear(s.startYear) : '?'
    const end = s.endYear !== 0 ? formatYear(s.endYear) : '?'
    details.push(`${start} – ${end}`)
  }
  if (details.length) html += `<div class="map-tooltip-detail">${details.join(' · ')}</div>`

  return html
}

export function SettlementLayer({
  data,
  enabledTypes,
  hiddenCategories,
  populationData,
}: SettlementLayerProps) {
  const { zoom, bounds } = useMapViewport()
  const currentYear = useTimelineStore((s) => s.currentYear)
  const wikiLookup = useWikiEnrichment('settlements')

  // Build population lookup by settlement name
  const popLookup = useMemo(() => {
    if (!populationData) return null
    const lookup = new Map<string, CityPopulation>()
    for (const cp of populationData) {
      lookup.set(cp.name.toLowerCase(), cp)
      for (const variant of cp.latinVariants) {
        lookup.set(variant.toLowerCase(), cp)
      }
    }
    return lookup
  }, [populationData])

  const visible = useMemo(() => {
    return data.filter((s) => {
      if (!enabledTypes.has(s.type)) return false

      // Category filtering
      const category = DARE_TYPE_TO_CATEGORY[s.type]
      if (category && hiddenCategories.has(category)) return false

      // Timeline filtering
      if (s.startYear !== 0 && s.startYear > currentYear) return false
      if (s.endYear !== 0 && s.endYear < currentYear) return false
      // Territory-correlated undated settlements: visible 20 years after territory control
      if (s.startYear === 0 && s.territoryYear != null) {
        if (currentYear < s.territoryYear + 20) return false
        if (s.declineYear != null && currentYear > s.declineYear + 50) return false
      }

      // Type-aware zoom filtering
      const threshold = getZoomThreshold(s.type, s.major)
      if (zoom < threshold) return false

      // Bounds filtering at zoomed-in levels
      if (zoom >= 7) {
        return (
          s.lat >= bounds.getSouth() &&
          s.lat <= bounds.getNorth() &&
          s.lng >= bounds.getWest() &&
          s.lng <= bounds.getEast()
        )
      }

      return true
    })
  }, [data, zoom, bounds, currentYear, enabledTypes, hiddenCategories])

  return (
    <>
      {visible.map((s) => {
        const { color, radius: baseRadius } = getSettlementStyle(s.type, s.major, zoom)

        // Check for population data
        let population: number | null = null
        let radius = baseRadius
        if (popLookup) {
          const cp = popLookup.get(s.name.toLowerCase())
          if (cp) {
            population = interpolatePopulation(cp.populations, currentYear)
            if (population != null && population > 0) {
              radius = populationRadius(population, zoom)
            }
          }
        }

        return (
          <CircleMarker
            key={s.id}
            center={[s.lat, s.lng]}
            radius={radius}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: population != null ? 0.85 : 0.8,
              weight: population != null ? 0.8 : 0.5,
            }}
            bubblingMouseEvents={false}
          >
            <Popup key={wikiLookup ? 'w' : 'p'} offset={[0, -4]} closeButton={false}>
              <span
                dangerouslySetInnerHTML={{
                  __html: appendWikiTooltip(
                    buildTooltipHtml(s, population),
                    s.id,
                    wikiLookup,
                    'settlements',
                  ),
                }}
              />
            </Popup>
          </CircleMarker>
        )
      })}
    </>
  )
}
