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
    const props = feature.properties || {}
    if (!props.name && !props.major) return
    let html = ''
    if (props.name) html += `<div class="map-tooltip-title">${props.name}</div>`
    const sub: string[] = []
    if (props.major) sub.push('Major road')
    if (props.attestedYear != null) {
      const y = props.attestedYear as number
      sub.push(`Attested: ${y < 0 ? `${Math.abs(y)} BC` : `${y} AD`}`)
    }
    if (sub.length) html += `<div class="map-tooltip-sub">${sub.join(' · ')}</div>`
    if (html) {
      ;(layer as L.Path).bindPopup(html)
    }
  }, [])

  return (
    <GeoJSON
      key={`dare-roads-${currentYear}`}
      data={filtered}
      style={getStyle}
      onEachFeature={onEachRoad}
      pane="overlayPane"
    />
  )
}
