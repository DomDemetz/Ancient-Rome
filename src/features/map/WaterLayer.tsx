import { GeoJSON } from 'react-leaflet'
import type { FeatureCollection, Feature } from 'geojson'
import type { PathOptions } from 'leaflet'
import L from 'leaflet'

interface WaterLayerProps {
  data: FeatureCollection
}

function getWaterStyle(feature: Feature | undefined): PathOptions {
  const isLake = feature?.properties?.kind === 'lake'
  if (isLake) {
    return {
      color: '#2980b9',
      weight: 1,
      opacity: 0.6,
      fillColor: '#2980b9',
      fillOpacity: 0.25,
    }
  }
  return {
    color: '#3498db',
    weight: 1.5,
    opacity: 0.6,
  }
}

function onEachWater(feature: Feature, layer: L.Layer) {
  const name = feature.properties?.name
  const modern = feature.properties?.modern
  const label = name && modern && name !== modern ? `${name} (${modern})` : name || modern
  if (label) {
    ;(layer as L.Path).bindTooltip(label, { sticky: true })
  }
}

export function WaterLayer({ data }: WaterLayerProps) {
  return (
    <GeoJSON
      key={data.features.length}
      data={data}
      interactive={false}
      style={getWaterStyle}
      onEachFeature={onEachWater}
    />
  )
}
