import { esc } from '@/lib/wiki-popup'
import { Marker } from 'react-leaflet'
import L from 'leaflet'
import { useMapViewport } from '@/hooks/useMapViewport'

/**
 * Latin sea names in italic serif — the old-atlas signature. Static,
 * period-neutral Latin (the atlas's voice), visible at region zooms only.
 */
const SEAS: Array<{ name: string; lat: number; lng: number; minZoom: number }> = [
  { name: 'Mare Internum', lat: 35.2, lng: 18.5, minZoom: 4 },
  { name: 'Oceanus Atlanticus', lat: 44.0, lng: -12.5, minZoom: 4 },
  { name: 'Pontus Euxinus', lat: 43.3, lng: 34.5, minZoom: 5 },
  { name: 'Mare Rubrum', lat: 20.5, lng: 38.5, minZoom: 5 },
  { name: 'Mare Adriaticum', lat: 42.8, lng: 15.3, minZoom: 6 },
  { name: 'Mare Aegaeum', lat: 38.8, lng: 25.2, minZoom: 6 },
  { name: 'Mare Tyrrhenum', lat: 39.9, lng: 12.2, minZoom: 6 },
  { name: 'Sinus Persicus', lat: 27.3, lng: 51.3, minZoom: 5 },
  { name: 'Mare Germanicum', lat: 55.6, lng: 3.5, minZoom: 5 },
]

export function SeaLabels() {
  const { zoom } = useMapViewport()
  return (
    <>
      {SEAS.filter((s) => zoom >= s.minZoom && zoom <= 8).map((s) => (
        <Marker
          key={s.name}
          position={[s.lat, s.lng]}
          interactive={false}
          icon={L.divIcon({
            className: 'sea-label-wrap',
            html: `<div class="sea-label">${esc(s.name)}</div>`,
            iconSize: [0, 0],
          })}
        />
      ))}
    </>
  )
}
