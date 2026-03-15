import { GeoJSON } from 'react-leaflet'
import type { FeatureCollection, Feature } from 'geojson'
import type { PathOptions } from 'leaflet'
import L from 'leaflet'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useMemo, useCallback } from 'react'
import { shouldShowRoad, getRoadOpacity, getDeclineDash } from '@/lib/road-style'

interface RoadLayerProps {
  data: FeatureCollection
}

export function RoadLayer({ data }: RoadLayerProps) {
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

      if (props.isNamed) {
        const opacity = getRoadOpacity(props, currentYear, 0.9)
        const dashArray = getDeclineDash(props.declineYear, currentYear, false)
        return { weight: 3.5, opacity, color: '#d4a74a', dashArray }
      }

      const isMajor = props.major === true
      const isUnknown = props.unknown === true
      const baseOpacity = isMajor ? 0.8 : 0.5
      const opacity = getRoadOpacity(props, currentYear, baseOpacity)
      const dashArray = getDeclineDash(props.declineYear, currentYear, isUnknown)

      return {
        color: '#d4a74a',
        weight: isMajor ? 2.5 : 1.5,
        opacity,
        dashArray,
      }
    },
    [currentYear],
  )

  const onEachRoad = useCallback((feature: Feature, layer: L.Layer) => {
    const name = feature.properties?.name
    if (name) {
      ;(layer as L.Path).bindTooltip(name, { sticky: true })
    }
  }, [])

  return (
    <GeoJSON
      key={`dare-roads-${currentYear}`}
      data={filtered}
      interactive={false}
      style={getStyle}
      onEachFeature={onEachRoad}
    />
  )
}
