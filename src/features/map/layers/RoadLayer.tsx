import { GeoJSON } from 'react-leaflet'
import type { FeatureCollection, Feature } from 'geojson'
import type { PathOptions } from 'leaflet'
import L from 'leaflet'
import { buildPopup } from '@/lib/wiki-popup'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useMemo, useCallback } from 'react'
import { shouldShowRoad, getRoadOpacity, getDeclineDash } from '@/lib/road-style'
import { filterWithSignature } from '@/lib/feature-signature'

interface RoadLayerProps {
  data: FeatureCollection
}

export function RoadLayer({ data }: RoadLayerProps) {
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
    const props = feature.properties || {}
    if (!props.name && !props.major) return
    // unnamed major roads have no heading of their own — "Major road"
    // becomes the title instead of the sub line
    const sub: string[] = []
    if (props.name && props.major) sub.push('Major road')
    if (props.attestedYear != null) {
      const y = props.attestedYear as number
      sub.push(`Attested: ${y < 0 ? `${Math.abs(y)} BC` : `${y} AD`}`)
    }
    ;(layer as L.Path).bindPopup(
      buildPopup({ title: props.name || 'Major road', sub: sub.join(' · ') }),
    )
  }, [])

  return (
    <GeoJSON
      key={`dare-roads-${sig}`}
      data={filtered}
      style={getStyle}
      onEachFeature={onEachRoad}
      pane="overlayPane"
    />
  )
}
