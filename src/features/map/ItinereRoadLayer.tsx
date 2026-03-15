import { GeoJSON } from 'react-leaflet'
import type { FeatureCollection, Feature } from 'geojson'
import type { PathOptions } from 'leaflet'
import L from 'leaflet'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useMemo, useCallback } from 'react'

interface ItinereRoadLayerProps {
  data: FeatureCollection
}

function getRoadStyle(feature: Feature | undefined): PathOptions {
  const props = feature?.properties || {}
  const isMain = props.type === 'main'
  const certainty = props.certainty as string

  return {
    color: '#b87333',
    weight: isMain ? 2.5 : 1.5,
    opacity: isMain ? 0.8 : 0.5,
    ...(certainty === 'hypothetical' || certainty === 'conjectured' ? { dashArray: '4 3' } : {}),
  }
}

export function ItinereRoadLayer({ data }: ItinereRoadLayerProps) {
  const currentYear = useTimelineStore((s) => s.currentYear)

  const filtered = useMemo(() => {
    const features = data.features.filter((f) => {
      const { startYear, endYear } = f.properties || {}
      if (startYear !== 0 && startYear > currentYear) return false
      if (endYear !== 0 && endYear < currentYear) return false
      return true
    })
    return { ...data, features }
  }, [data, currentYear])

  const onEachRoad = useCallback((feature: Feature, layer: L.Layer) => {
    const props = feature.properties || {}
    const parts: string[] = []
    if (props.name) parts.push(props.name)
    if (props.builder) parts.push(`Built by: ${props.builder}`)
    if (parts.length > 0) {
      ;(layer as L.Path).bindTooltip(parts.join('<br>'), { sticky: true })
    }
  }, [])

  return (
    <GeoJSON
      key={`itinere-roads-${currentYear}`}
      data={filtered}
      style={getRoadStyle}
      onEachFeature={onEachRoad}
    />
  )
}
