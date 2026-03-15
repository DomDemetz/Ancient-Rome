import { GeoJSON, Marker } from 'react-leaflet'
import type { FeatureCollection, Feature } from 'geojson'
import type { PathOptions } from 'leaflet'
import L from 'leaflet'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useMemo, useCallback, useRef } from 'react'
import type { ProvinceLabel, ProvinceChange } from '@/data/dare'

interface ProvinceLayerProps {
  data: FeatureCollection
  labels?: ProvinceLabel[]
  changes?: ProvinceChange[]
  senatorialProvinces?: FeatureCollection | null
}

const PROVINCE_STYLE: PathOptions = {
  color: '#a08cd6',
  weight: 2,
  opacity: 0.9,
  fillColor: '#8e7cc3',
  fillOpacity: 0.15,
  dashArray: '5 3',
  pane: 'basePolygons',
}

const SELECTED_STYLE: PathOptions = {
  color: '#b89aef',
  weight: 3,
  opacity: 1,
  fillColor: '#8e7cc3',
  fillOpacity: 0.3,
  pane: 'basePolygons',
  dashArray: undefined,
}

// Senatorial provinces: governed by the Senate (lighter, distinct color)
const SENATORIAL_STYLE: PathOptions = {
  color: '#e0c04a',
  weight: 2,
  opacity: 0.85,
  fillColor: '#d4af37',
  fillOpacity: 0.18,
  pane: 'basePolygons',
  dashArray: '3 3',
}

function createLabelIcon(name: string): L.DivIcon {
  return L.divIcon({
    className: 'province-label',
    html: name,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

function onEachSenatorial(feature: Feature, layer: L.Layer) {
  const name = feature.properties?.name
  if (name) {
    ;(layer as L.Path).bindPopup(`<div class="map-tooltip-title">${name} (Senatorial)</div>`)
  }
}

export function ProvinceLayer({ data, labels, changes, senatorialProvinces }: ProvinceLayerProps) {
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

  // Show senatorial provinces only during the Principate (27 BC - 284 AD)
  const showSenatorial = senatorialProvinces && currentYear >= -27 && currentYear <= 284

  // Compute labels including province reorganizations
  const allLabels = useMemo(() => {
    const baseLabels = (labels || []).filter((l) => {
      if (l.startYear !== 0 && l.startYear > currentYear) return false
      if (l.endYear !== 0 && l.endYear < currentYear) return false
      return true
    })

    if (!changes || changes.length === 0) return baseLabels

    const reorganized = new Set<string>()
    const extraLabels: ProvinceLabel[] = []

    for (const change of changes) {
      if (change.splitYear <= currentYear) {
        reorganized.add(change.originalName)
        for (const np of change.newProvinces) {
          extraLabels.push({
            name: np.name,
            lat: np.labelLat,
            lng: np.labelLng,
            startYear: change.splitYear,
            endYear: 476,
          })
        }
      }
    }

    const filteredBase = baseLabels.filter((l) => !reorganized.has(l.name))
    return [...filteredBase, ...extraLabels]
  }, [labels, changes, currentYear])

  const onEachProvince = useCallback((feature: Feature, layer: L.Layer) => {
    const path = layer as L.Path
    const name = feature.properties?.name
    if (name) {
      path.bindPopup(`<div class="map-tooltip-title">${name}</div>`)
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
        selectedRef.current = path
      }
    })
  }, [])

  return (
    <>
      <GeoJSON
        key={`provinces-${currentYear}`}
        data={filtered}
        pane="basePolygons"
        bubblingMouseEvents
        style={() => PROVINCE_STYLE}
        onEachFeature={onEachProvince}
      />
      {/* Senatorial province overlay (27 BC - 284 AD) */}
      {showSenatorial && (
        <GeoJSON
          key={`senatorial-${currentYear}`}
          data={senatorialProvinces}
          pane="basePolygons"
          bubblingMouseEvents
          style={() => SENATORIAL_STYLE}
          onEachFeature={onEachSenatorial}
        />
      )}
      {allLabels.map((label) => (
        <Marker
          key={`${label.name}-${label.lat}`}
          position={[label.lat, label.lng]}
          icon={createLabelIcon(label.name)}
          interactive={false}
        />
      ))}
    </>
  )
}
