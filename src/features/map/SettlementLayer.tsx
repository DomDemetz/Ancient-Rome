import { useCallback, useMemo, useState } from 'react'
import { CircleMarker, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import type { DareSettlement, CityPopulation } from '@/data/dare'
import { useTimelineStore } from '@/stores/useTimelineStore'
import {
  DARE_TYPE_LABELS,
  DARE_TYPE_TO_CATEGORY,
  CATEGORY_STYLES,
  getSettlementStyle,
} from './settlementStyles'

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

function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year)} BC`
  return `${year} AD`
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
      const t = (year - pops[i].year) / (pops[i + 1].year - pops[i].year)
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

function buildTooltip(s: DareSettlement, population?: number | null): string {
  const lines: string[] = [s.name]

  if (s.modern && s.modern !== s.name) {
    lines.push(`(${s.modern})`)
  }
  if (s.greek) {
    lines.push(`Greek: ${s.greek}`)
  }

  const typeLabel = DARE_TYPE_LABELS[s.type]
  const category = DARE_TYPE_TO_CATEGORY[s.type]
  const categoryLabel = category ? CATEGORY_STYLES[category].label : null

  if (typeLabel && categoryLabel) {
    lines.push(`${typeLabel} \u00b7 ${categoryLabel}`)
  } else if (typeLabel) {
    lines.push(typeLabel)
  }

  if (population != null && population > 0) {
    lines.push(`Pop: ~${formatPopulation(population)}`)
  }

  if (s.startYear !== 0 || s.endYear !== 0) {
    const start = s.startYear !== 0 ? formatYear(s.startYear) : '?'
    const end = s.endYear !== 0 ? formatYear(s.endYear) : '?'
    lines.push(`${start} \u2013 ${end}`)
  }

  return lines.join('\n')
}

export function SettlementLayer({
  data,
  enabledTypes,
  hiddenCategories,
  populationData,
}: SettlementLayerProps) {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())
  const [bounds, setBounds] = useState(map.getBounds())
  const currentYear = useTimelineStore((s) => s.currentYear)

  const updateView = useCallback(() => {
    setZoom(map.getZoom())
    setBounds(map.getBounds())
  }, [map])

  useMapEvents({
    zoomend: updateView,
    moveend: updateView,
  })

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
            <Tooltip direction="top" offset={[0, -4]}>
              <span style={{ whiteSpace: 'pre-line' }}>{buildTooltip(s, population)}</span>
            </Tooltip>
          </CircleMarker>
        )
      })}
    </>
  )
}
