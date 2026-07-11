import { useMemo } from 'react'
import { GeoJSON, Marker } from 'react-leaflet'
import type { FeatureCollection, Feature, Position } from 'geojson'
import type { PathOptions } from 'leaflet'
import L from 'leaflet'
import { buildPopup, esc } from '@/lib/wiki-popup'
import { useMapViewport } from '@/hooks/useMapViewport'
import waterEnrichmentRaw from '@/data/registry/water-enrichment.json?raw'

// research-swarm enrichment: {name -> {desc?, qid?, wiki?}} — descriptions
// are one attested sentence; identity verified against P31 + coordinates
const WATER_ENRICHMENT = JSON.parse(waterEnrichmentRaw) as Record<
  string,
  { desc?: string; qid?: string; wiki?: string }
>

interface WaterLayerProps {
  data: FeatureCollection
}

function getWaterStyle(feature: Feature | undefined): PathOptions {
  const isLake = feature?.properties?.kind === 'lake'
  if (isLake) {
    return {
      color: '#2980b9',
      weight: 1,
      opacity: 0.6,
      fillColor: '#2980b9',
      fillOpacity: 0.25,
    }
  }
  return {
    color: '#3498db',
    weight: 1.5,
    opacity: 0.6,
  }
}

function onEachWater(feature: Feature, layer: L.Layer) {
  const name = feature.properties?.name
  const modern = feature.properties?.modern
  const kind = feature.properties?.kind === 'lake' ? 'Lake' : 'River'
  const title = name || modern
  if (!title) return
  const enrich = WATER_ENRICHMENT[name ?? ''] ?? WATER_ENRICHMENT[modern ?? '']
  let bodyHtml: string | undefined
  if (enrich?.desc) {
    bodyHtml = `<div class="map-tooltip-wiki"><div class="map-tooltip-extract">${esc(enrich.desc)}</div>`
    if (enrich.wiki) {
      bodyHtml += `<a class="map-tooltip-readmore" target="_blank" rel="noopener noreferrer" href="https://en.wikipedia.org/wiki/${esc(enrich.wiki.replace(/ /g, '_'))}">Wikipedia</a>`
    }
    bodyHtml += '</div>'
  }
  ;(layer as L.Path).bindPopup(
    buildPopup({
      title,
      sub: kind,
      details: modern && modern !== title ? [modern] : [],
      source: 'DARE',
      bodyHtml,
    }),
  )
}

/** Label anchor: rivers use the midpoint of their longest line; lakes the
 *  bbox center of their outer ring. */
function labelAnchor(feature: Feature): [number, number] | null {
  const g = feature.geometry
  if (g.type === 'MultiLineString') {
    let best: Position[] = []
    for (const line of g.coordinates) if (line.length > best.length) best = line
    if (best.length === 0) return null
    const [lng, lat] = best[Math.floor(best.length / 2)]
    return [lat, lng]
  }
  if (g.type === 'Polygon') {
    const ring = g.coordinates[0]
    if (!ring?.length) return null
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity
    for (const [x, y] of ring) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    return [(minY + maxY) / 2, (minX + maxX) / 2]
  }
  return null
}

/** The great rivers earn their name at region zooms; the rest at z6+. */
const MAJOR_WATERS = new Set([
  'Danuvius',
  'Rhenus',
  'Nilus',
  'Euphrates',
  'Tigris',
  'Padus',
  'Tiberis',
  'Rhodanus',
])

export function WaterLayer({ data }: WaterLayerProps) {
  const { zoom, bounds } = useMapViewport()

  // Latin water names in the sea-label voice (Dominik 2026-07-11: rivers
  // and lakes deserve names like the oceans). One label per name — the
  // Euphrates is four features but one river.
  const labels = useMemo(() => {
    const seen = new Set<string>()
    const out: Array<{ name: string; lat: number; lng: number; major: boolean }> = []
    for (const f of data.features) {
      const name = f.properties?.name
      if (!name || seen.has(name)) continue
      const anchor = labelAnchor(f)
      if (!anchor) continue
      seen.add(name)
      out.push({ name, lat: anchor[0], lng: anchor[1], major: MAJOR_WATERS.has(name) })
    }
    return out
  }, [data])

  // greedy declutter, majors claim space first (the lake districts pile
  // half a dozen names into one viewport otherwise)
  const visibleLabels = useMemo(() => {
    const pxPerDegX = (256 * Math.pow(2, zoom)) / 360
    const pxPerDegY = pxPerDegX // near-enough at label latitudes for a declutter
    const inView = labels.filter(
      (l) =>
        zoom >= (l.major ? 5 : 6) &&
        zoom <= 9 &&
        l.lat >= bounds.getSouth() &&
        l.lat <= bounds.getNorth() &&
        l.lng >= bounds.getWest() &&
        l.lng <= bounds.getEast(),
    )
    inView.sort((a2, b2) => Number(b2.major) - Number(a2.major))
    const placed: Array<{ lat: number; lng: number }> = []
    return inView.filter((l) => {
      const collides = placed.some(
        (p2) =>
          Math.abs(p2.lng - l.lng) * pxPerDegX < 90 && Math.abs(p2.lat - l.lat) * pxPerDegY < 22,
      )
      if (collides) return false
      placed.push(l)
      return true
    })
  }, [labels, zoom, bounds])

  return (
    <>
      <GeoJSON
        key={`water-${data.features.length}-${data.features[0]?.properties?.name ?? ''}`}
        data={data}
        style={getWaterStyle}
        onEachFeature={onEachWater}
      />
      {visibleLabels.map((l) => (
        <Marker
          key={l.name}
          position={[l.lat, l.lng]}
          interactive={false}
          icon={L.divIcon({
            className: 'sea-label-wrap',
            html: `<div class="sea-label sea-label--water">${esc(l.name)}</div>`,
            iconSize: [0, 0],
          })}
        />
      ))}
    </>
  )
}
