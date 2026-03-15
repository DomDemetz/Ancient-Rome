import { GeoJSON } from 'react-leaflet'
import type { FeatureCollection, Feature } from 'geojson'
import type { PathOptions } from 'leaflet'
import L from 'leaflet'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useMemo } from 'react'

interface LimesLayerProps {
  data: FeatureCollection
}

const LIMES_STYLE: PathOptions = {
  color: '#c0392b',
  weight: 2.5,
  opacity: 0.8,
  dashArray: '6 4',
}

function onEachLimes(feature: Feature, layer: L.Layer) {
  const sector = feature.properties?.sector
  if (sector) {
    ;(layer as L.Path).bindPopup(`<div class="map-tooltip-title">${sector}</div>`)
  }
}

export function LimesLayer({ data }: LimesLayerProps) {
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

  return (
    <GeoJSON
      key={`limes-${currentYear}`}
      data={filtered}
      style={() => LIMES_STYLE}
      onEachFeature={onEachLimes}
    />
  )
}
