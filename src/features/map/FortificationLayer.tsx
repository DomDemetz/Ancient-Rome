import { GeoJSON } from 'react-leaflet'
import type { FeatureCollection, Feature } from 'geojson'
import type { PathOptions } from 'leaflet'
import L from 'leaflet'

interface FortificationLayerProps {
  data: FeatureCollection
}

const FORTIFICATION_STYLE: PathOptions = {
  color: '#e67e22',
  weight: 2.5,
  opacity: 0.8,
  dashArray: '2 4',
}

function onEachFortification(feature: Feature, layer: L.Layer) {
  const name = feature.properties?.name
  if (name) {
    ;(layer as L.Path).bindTooltip(name, { sticky: true })
  }
}

export function FortificationLayer({ data }: FortificationLayerProps) {
  return (
    <GeoJSON
      key={data.features.length}
      data={data}
      style={() => FORTIFICATION_STYLE}
      onEachFeature={onEachFortification}
    />
  )
}
