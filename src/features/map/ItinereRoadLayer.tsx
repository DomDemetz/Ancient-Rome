import { GeoJSON } from 'react-leaflet'
import type { FeatureCollection, Feature } from 'geojson'
import type { PathOptions } from 'leaflet'
import L from 'leaflet'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useMemo, useCallback } from 'react'
import { shouldShowRoad, getRoadOpacity, getDeclineDash } from '@/lib/road-style'

interface ItinereRoadLayerProps {
  data: FeatureCollection
}

export function ItinereRoadLayer({ data }: ItinereRoadLayerProps) {
  const currentYear = useTimelineStore((s) => s.currentYear)

  const filtered = useMemo(() => {
    const features = data.features.filter((f) => {
      return shouldShowRoad(f.properties || {}, currentYear)
    })
    return { ...data, features }
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
    const parts: string[] = []
    if (props.name) parts.push(props.name)
    if (
      props.builder &&
      props.builder !== 'Conjectured' &&
      props.builder !== 'Hypothetical' &&
      props.builder !== 'Certain'
    ) {
      parts.push(`Built by: ${props.builder}`)
    }
    if (parts.length > 0) {
      ;(layer as L.Path).bindTooltip(parts.join('<br>'), { sticky: true })
    }
  }, [])

  return (
    <GeoJSON
      key={`itinere-roads-${currentYear}`}
      data={filtered}
      style={getStyle}
      onEachFeature={onEachRoad}
    />
  )
}
