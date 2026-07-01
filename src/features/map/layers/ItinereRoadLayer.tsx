import { GeoJSON } from 'react-leaflet'
import type { FeatureCollection, Feature } from 'geojson'
import type { PathOptions } from 'leaflet'
import L from 'leaflet'
import { esc } from '@/lib/wiki-popup'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useMemo, useCallback } from 'react'
import { shouldShowRoad, getRoadOpacity, getDeclineDash } from '@/lib/road-style'
import { filterWithSignature } from '@/lib/feature-signature'

interface ItinereRoadLayerProps {
  data: FeatureCollection
}

export function ItinereRoadLayer({ data }: ItinereRoadLayerProps) {
  const currentYear = useTimelineStore((s) => s.currentYear)

  const { filtered, sig } = useMemo(() => {
    const { features, sig } = filterWithSignature(data.features, (f) =>
      shouldShowRoad(f.properties || {}, currentYear),
    )
    return { filtered: { ...data, features }, sig }
  }, [data, currentYear])

  const getStyle = useCallback(
    (feature: Feature | undefined): PathOptions => {
      const props = feature?.properties || {}
      const certainty = props.certainty as string
      const isHypothetical = certainty === 'hypothetical' || certainty === 'conjectured'
      const opacity = getRoadOpacity(props, currentYear, 0.5)
      const dashArray = getDeclineDash(props.declineYear, currentYear, isHypothetical)

      return {
        color: '#b87333',
        weight: 1.5,
        opacity,
        dashArray,
      }
    },
    [currentYear],
  )

  const onEachRoad = useCallback((feature: Feature, layer: L.Layer) => {
    const props = feature.properties || {}
    if (!props.name) return
    let html = `<div class="map-tooltip-title">${esc(props.name)}</div>`
    const sub: string[] = []
    if (props.type) sub.push(esc(props.type))
    if (props.certainty && props.certainty !== 'certain') sub.push(esc(props.certainty))
    if (sub.length) html += `<div class="map-tooltip-sub">${sub.join(' · ')}</div>`
    const details: string[] = []
    if (
      props.builder &&
      props.builder !== 'Conjectured' &&
      props.builder !== 'Hypothetical' &&
      props.builder !== 'Certain'
    ) {
      details.push(`Built by: ${esc(props.builder)}`)
    }
    if (props.attestedYear != null) {
      const y = props.attestedYear as number
      details.push(`Attested: ${y < 0 ? `${Math.abs(y)} BC` : `${y} AD`}`)
    }
    if (details.length) html += `<div class="map-tooltip-detail">${details.join(' · ')}</div>`
    ;(layer as L.Path).bindPopup(html)
  }, [])

  return (
    <GeoJSON
      key={`itinere-roads-${sig}`}
      data={filtered}
      style={getStyle}
      onEachFeature={onEachRoad}
      pane="overlayPane"
    />
  )
}
