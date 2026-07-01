import { GeoJSON } from 'react-leaflet'
import type { FeatureCollection, Feature } from 'geojson'
import type { PathOptions } from 'leaflet'
import L from 'leaflet'
import { esc } from '@/lib/wiki-popup'
import { filterWithSignature } from '@/lib/feature-signature'
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
// Stable style reference — never triggers a needless setStyle re-apply.
const limesStyle = () => LIMES_STYLE

function onEachLimes(feature: Feature, layer: L.Layer) {
  const sector = feature.properties?.sector
  if (sector) {
    ;(layer as L.Path).bindPopup(`<div class="map-tooltip-title">${esc(sector)}</div>`)
  }
}

export function LimesLayer({ data }: LimesLayerProps) {
  const currentYear = useTimelineStore((s) => s.currentYear)

  const { filtered, sig } = useMemo(() => {
    const { features, sig } = filterWithSignature(data.features, (f) => {
      const { startYear, endYear } = f.properties || {}
      if (startYear !== 0 && startYear > currentYear) return false
      if (endYear !== 0 && endYear < currentYear) return false
      return true
    })
    return { filtered: { ...data, features }, sig }
  }, [data, currentYear])

  return (
    <GeoJSON key={`limes-${sig}`} data={filtered} style={limesStyle} onEachFeature={onEachLimes} />
  )
}
