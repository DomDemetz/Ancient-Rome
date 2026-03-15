import { GeoJSON } from 'react-leaflet'
import type { FeatureCollection, Feature } from 'geojson'
import type { PathOptions } from 'leaflet'
import L from 'leaflet'

interface RoadLayerProps {
  data: FeatureCollection
}

function getRoadStyle(feature: Feature | undefined): PathOptions {
  const props = feature?.properties || {}
  const isMajor = props.major === true
  const isUnknown = props.unknown === true

  return {
    color: '#d4a74a',
    weight: isMajor ? 2.5 : 1.5,
    opacity: isMajor ? 0.8 : 0.5,
    ...(isUnknown ? { dashArray: '4 3' } : {}),
  }
}

function onEachRoad(feature: Feature, layer: L.Layer) {
  const name = feature.properties?.name
  if (name) {
    ;(layer as L.Path).bindTooltip(name, { sticky: true })
  }
}

export function RoadLayer({ data }: RoadLayerProps) {
  return (
    <GeoJSON
      key={data.features.length}
      data={data}
      style={getRoadStyle}
      onEachFeature={onEachRoad}
    />
  )
}
