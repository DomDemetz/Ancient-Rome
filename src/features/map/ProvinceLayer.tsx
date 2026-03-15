import { GeoJSON, Marker } from 'react-leaflet'
import type { FeatureCollection, Feature } from 'geojson'
import type { PathOptions } from 'leaflet'
import L from 'leaflet'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useMemo, useCallback, useRef } from 'react'
import type { ProvinceLabel } from '@/data/dare'

interface ProvinceLayerProps {
  data: FeatureCollection
  labels?: ProvinceLabel[]
}

const PROVINCE_STYLE: PathOptions = {
  color: '#8e7cc3',
  weight: 1.5,
  opacity: 0.7,
  fillColor: '#8e7cc3',
  fillOpacity: 0.08,
  dashArray: '5 3',
}

const SELECTED_STYLE: PathOptions = {
  color: '#6a4db3',
  weight: 2.5,
  opacity: 1,
  fillColor: '#6a4db3',
  fillOpacity: 0.25,
  dashArray: undefined,
}

function createLabelIcon(name: string): L.DivIcon {
  return L.divIcon({
    className: 'province-label',
    html: name,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

export function ProvinceLayer({ data, labels }: ProvinceLayerProps) {
  const currentYear = useTimelineStore((s) => s.currentYear)
  const selectedRef = useRef<L.Path | null>(null)

  const filtered = useMemo(() => {
    const features = data.features.filter((f) => {
      const { startYear, endYear } = f.properties || {}
      if (startYear !== 0 && startYear > currentYear) return false
      if (endYear !== 0 && endYear < currentYear) return false
      return true
    })
    return { ...data, features }
  }, [data, currentYear])

  const filteredLabels = useMemo(() => {
    if (!labels) return []
    return labels.filter((l) => {
      if (l.startYear !== 0 && l.startYear > currentYear) return false
      if (l.endYear !== 0 && l.endYear < currentYear) return false
      return true
    })
  }, [labels, currentYear])

  const onEachProvince = useCallback((feature: Feature, layer: L.Layer) => {
    const path = layer as L.Path
    const name = feature.properties?.name
    if (name) {
      path.bindTooltip(name, { sticky: true })
    }
    path.on('click', () => {
      if (selectedRef.current && selectedRef.current !== path) {
        selectedRef.current.setStyle(PROVINCE_STYLE)
      }
      if (selectedRef.current === path) {
        path.setStyle(PROVINCE_STYLE)
        selectedRef.current = null
      } else {
        path.setStyle(SELECTED_STYLE)
        path.bringToFront()
        selectedRef.current = path
      }
    })
  }, [])

  return (
    <>
      <GeoJSON
        key={`provinces-${currentYear}`}
        data={filtered}
        style={() => PROVINCE_STYLE}
        onEachFeature={onEachProvince}
      />
      {filteredLabels.map((label) => (
        <Marker
          key={label.name}
          position={[label.lat, label.lng]}
          icon={createLabelIcon(label.name)}
          interactive={false}
        />
      ))}
    </>
  )
}
