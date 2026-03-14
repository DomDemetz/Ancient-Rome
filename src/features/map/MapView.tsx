import 'leaflet/dist/leaflet.css'
import { useState } from 'react'
import { MapContainer, TileLayer } from 'react-leaflet'
import { territories } from '@/data'
import { EntityMarkers } from './EntityMarkers'
import { TerritoryLayer } from './TerritoryLayer'
import { MapControls } from './MapControls'

const ROME_CENTER: [number, number] = [41.9, 12.5]
const DEFAULT_ZOOM = 5

const DARK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const DARK_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

export function MapView() {
  const [showTerritories, setShowTerritories] = useState(true)

  return (
    <div className="relative w-full h-full" style={{ background: '#0f0a1a' }}>
      <MapContainer
        center={ROME_CENTER}
        zoom={DEFAULT_ZOOM}
        style={{ width: '100%', height: '100%', background: '#0f0a1a' }}
        zoomControl={true}
      >
        <TileLayer url={DARK_TILE_URL} attribution={DARK_TILE_ATTRIBUTION} />

        <EntityMarkers />

        {showTerritories && <TerritoryLayer snapshots={territories} />}
      </MapContainer>

      <MapControls
        showTerritories={showTerritories}
        onToggleTerritories={() => setShowTerritories((v) => !v)}
      />
    </div>
  )
}
