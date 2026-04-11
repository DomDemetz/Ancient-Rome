import { useState, useCallback } from 'react'
import { useMap, useMapEvents } from 'react-leaflet'
import type { LatLngBounds, Map } from 'leaflet'

/** Returns current map reference, zoom level, and visible bounds — auto-updates on pan/zoom. */
export function useMapViewport(): { map: Map; zoom: number; bounds: LatLngBounds } {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())
  const [bounds, setBounds] = useState(map.getBounds())

  const updateView = useCallback(() => {
    setZoom(map.getZoom())
    setBounds(map.getBounds())
  }, [map])

  useMapEvents({
    zoomend: updateView,
    moveend: updateView,
  })

  return { map, zoom, bounds }
}
