import { GeoJSON } from 'react-leaflet'
import type { FeatureCollection, Feature } from 'geojson'
import type { PathOptions } from 'leaflet'
import L from 'leaflet'
import { esc } from '@/lib/wiki-popup'

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
    ;(layer as L.Path).bindPopup(`<div class="map-tooltip-title">${esc(label)}</div>`)
  }
}

export function WaterLayer({ data }: WaterLayerProps) {
  return (
    <GeoJSON
      key={`water-${data.features.length}-${data.features[0]?.properties?.name ?? ''}`}
      data={data}
      style={getWaterStyle}
      onEachFeature={onEachWater}
    />
  )
}
