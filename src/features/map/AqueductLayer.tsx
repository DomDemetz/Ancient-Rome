import { useMemo, useState, useCallback } from 'react'
import { CircleMarker, GeoJSON, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import type { FeatureCollection, Feature } from 'geojson'
import type { PathOptions } from 'leaflet'
import L from 'leaflet'
import type { Aqueduct } from '@/data/aqueducts'
import { useTimelineStore } from '@/stores/useTimelineStore'

interface AqueductLayerProps {
  data: Aqueduct[]
  lines?: FeatureCollection | null
}

const LINE_STYLE: PathOptions = {
  color: '#3498db',
  weight: 2,
  opacity: 0.7,
}

function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year)} BC`
  return `${year} AD`
}

function onEachAqueductLine(feature: Feature, layer: L.Layer) {
  const name = feature.properties?.name
  if (name) {
    ;(layer as L.Path).bindTooltip(name, { sticky: true })
  }
}

export function AqueductLayer({ data, lines }: AqueductLayerProps) {
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

  // Filter AWMC aqueduct lines by temporal data
  const filteredLines = useMemo(() => {
    if (!lines) return { type: 'FeatureCollection' as const, features: [] }
    const features = lines.features.filter((f) => {
      const props = f.properties || {}
      // Use constructionYear from name-matching if available
      const constructionYear = props.constructionYear as number | null
      if (constructionYear != null) {
        return currentYear >= constructionYear
      }
      // Fall back to territory correlation
      const territoryYear = props.territoryYear as number | null
      if (territoryYear == null) return false
      if (currentYear < territoryYear + 20) return false
      const declineYear = props.declineYear as number | null
      if (declineYear != null && currentYear > declineYear + 50) return false
      return true
    })
    return { ...lines, features }
  }, [lines, currentYear])

  const getLineStyle = useCallback(
    (feature: Feature | undefined): PathOptions => {
      const props = feature?.properties || {}
      const territoryYear = props.territoryYear as number | null
      const constructionYear = props.constructionYear as number | null
      const visYear = constructionYear ?? (territoryYear ?? 0) + 20
      const fadeIn = Math.min(1, Math.max(0, (currentYear - visYear) / 30))
      let opacity = 0.7 * fadeIn
      const declineYear = props.declineYear as number | null
      if (declineYear != null && currentYear > declineYear) {
        const decay = Math.min(1, (currentYear - declineYear) / 50)
        opacity *= 1 - decay
      }
      return { ...LINE_STYLE, opacity }
    },
    [currentYear],
  )

  const visible = useMemo(() => {
    return data.filter((a) => {
      if (a.constructionYear > currentYear) return false
      if (zoom < 6) return false
      if (zoom >= 7) {
        return (
          a.lat >= bounds.getSouth() &&
          a.lat <= bounds.getNorth() &&
          a.lng >= bounds.getWest() &&
          a.lng <= bounds.getEast()
        )
      }
      return true
    })
  }, [data, zoom, bounds, currentYear])

  const baseRadius = zoom >= 8 ? 5 : zoom >= 6 ? 4 : 3

  return (
    <>
      {/* Render AWMC aqueduct polylines when available — filtered by timeline */}
      {lines && zoom >= 6 && (
        <GeoJSON
          key={`aqueduct-lines-${currentYear}`}
          data={filteredLines}
          style={getLineStyle}
          onEachFeature={onEachAqueductLine}
        />
      )}

      {/* Render point-based aqueduct markers on top */}
      {visible.map((a) => {
        let tooltipHtml = `<div class="map-tooltip-title">${a.name}</div>`
        tooltipHtml += `<div class="map-tooltip-sub">${a.cityServed}</div>`
        const details: string[] = [`Built: ${formatYear(a.constructionYear)}`]
        if (a.length) details.push(`${a.length} km`)
        if (a.builder) details.push(a.builder)
        if (a.description) details.push(a.description)
        tooltipHtml += `<div class="map-tooltip-detail">${details.join(' · ')}</div>`

        return (
          <CircleMarker
            key={a.id}
            center={[a.lat, a.lng]}
            radius={baseRadius}
            pathOptions={{
              color: '#1a5276',
              weight: 1,
              fillColor: '#3498db',
              fillOpacity: 0.85,
            }}
            bubblingMouseEvents={false}
          >
            <Tooltip direction="top" offset={[0, -4]}>
              <span dangerouslySetInnerHTML={{ __html: tooltipHtml }} />
            </Tooltip>
          </CircleMarker>
        )
      })}
    </>
  )
}
