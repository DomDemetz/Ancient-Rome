import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, Popup, Tooltip } from 'react-leaflet'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useMapViewport } from '@/hooks/useMapViewport'
import { loadHistoricalCities, type HistoricalCity, type CityPopulationPoint } from '@/data/cities'
import { appendWikiTooltip, esc } from '@/lib/wiki-popup'
import { useWikiEnrichment } from '@/hooks/useWikiEnrichment'
import qidJson from '@/data/registry/chandler-qid.json'

// Canonical Wikidata identity per city (see ENTITY-MODEL.md) — powers the
// popup's Wikidata link for the ~200 cities with a resolved QID.
const CITY_QID = qidJson as Record<string, string>

// Only the biggest cities get a permanent label when zoomed out; the threshold
// drops as you zoom in, so labels stay legible instead of clumping.
function labelMinPop(zoom: number): number {
  if (zoom <= 4) return 250000
  if (zoom === 5) return 120000
  if (zoom === 6) return 60000
  if (zoom === 7) return 25000
  return 0
}

// Linear-interpolate a city's population at `year` from its sampled series.
function popAt(points: CityPopulationPoint[], year: number): number | null {
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

function radiusFor(pop: number): number {
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

/**
 * Major urban centres with population over time (Chandler / Reba et al., CC-BY).
 * Every city is date-bounded — it only renders within [startYear, endYear] — so
 * nothing appears before it existed. Used to carry the medieval centuries, where
 * the Roman-era settlement data runs out.
 */
export function CitiesLayer() {
  const currentYear = useTimelineStore((s) => s.currentYear)
  const { zoom } = useMapViewport()
  const wikiLookup = useWikiEnrichment('cities')
  const [cities, setCities] = useState<HistoricalCity[] | null>(null)

  useEffect(() => {
    let alive = true
    loadHistoricalCities().then((c) => {
      if (alive) setCities(c)
    })
    return () => {
      alive = false
    }
  }, [])

  const visible = useMemo(() => {
    if (!cities) return []
    return cities.filter((c) => c.startYear <= currentYear && c.endYear >= currentYear)
  }, [cities, currentYear])

  return (
    <>
      {visible.map((c) => {
        const pop = popAt(c.populations, currentYear)
        if (pop == null || pop <= 0) return null
        // Constantinople was Byzantium until Constantine refounded it in 330 AD.
        const name = c.name === 'Constantinople' && currentYear < 330 ? 'Byzantium' : c.name
        return (
          <CircleMarker
            key={c.id}
            center={[c.lat, c.lng]}
            radius={radiusFor(pop)}
            pathOptions={{
              color: '#fcd34d',
              fillColor: '#f59e0b',
              fillOpacity: 0.75,
              weight: 1,
            }}
            bubblingMouseEvents={false}
          >
            {pop >= labelMinPop(zoom) && (
              <Tooltip
                permanent
                direction="top"
                className="city-label"
                offset={[0, -radiusFor(pop) - 1]}
              >
                {name}
              </Tooltip>
            )}
            <Popup key={wikiLookup ? 'w' : 'p'} offset={[0, -4]} closeButton={false}>
              <span
                dangerouslySetInnerHTML={{
                  __html: appendWikiTooltip(
                    `<div class="map-tooltip-title">${esc(name)}</div>` +
                      `<div class="map-tooltip-detail">Population ~${fmtPop(pop)} · ${
                        currentYear < 0 ? `${-currentYear} BC` : `${currentYear} AD`
                      }</div>` +
                      (!wikiLookup?.[c.id] && CITY_QID[c.id]
                        ? `<div class="map-tooltip-detail"><a href="https://www.wikidata.org/wiki/${CITY_QID[c.id]}" target="_blank" rel="noopener noreferrer">Wikidata ↗</a></div>`
                        : ''),
                    c.id,
                    wikiLookup,
                    'cities',
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
