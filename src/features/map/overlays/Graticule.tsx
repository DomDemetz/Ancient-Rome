import { useMemo } from 'react'
import { Marker, Polyline } from 'react-leaflet'
import L from 'leaflet'
import { useMapViewport } from '@/hooks/useMapViewport'
import { graticuleStepMinutes, formatLatitude, formatLongitude } from '@/lib/measure'

const LINE_STYLE: L.PathOptions = {
  color: '#e2e8f0',
  weight: 1,
  opacity: 0.3,
  interactive: false,
}
// Web Mercator ends here; a meridian drawn to ±90° would run off the world
const MAX_LAT = 85
// labels sit this far inside the left / bottom edge of the view
const LABEL_INSET_PX = 10

function label(text: string, axis: 'lat' | 'lng') {
  return L.divIcon({
    className: 'graticule-label-wrap',
    html: `<div class="graticule-label graticule-label--${axis}">${text}</div>`,
    iconSize: [0, 0],
  })
}

/**
 * Latitude / longitude grid. Parallels and meridians are straight in this
 * projection, and the spacing between parallels is a fixed ground distance
 * (1° ≈ 111 km) — which is what makes the grid usable for measuring. Spacing
 * refines with zoom; each line is labelled where it meets the left or bottom
 * edge of the view.
 */
export function Graticule() {
  const { map, zoom, bounds } = useMapViewport()

  const { parallels, meridians, west, east, labelLng, labelLat } = useMemo(() => {
    const step = graticuleStepMinutes(zoom)
    // a screen of margin each way, so a drag never runs out of grid
    const padded = bounds.pad(1)
    const south = Math.max(-MAX_LAT, padded.getSouth())
    const north = Math.min(MAX_LAT, padded.getNorth())
    const steps = (from: number, to: number) => {
      const out: number[] = []
      for (let m = Math.ceil((from * 60) / step) * step; m <= to * 60; m += step) out.push(m)
      return out
    }
    const size = map.getSize()
    return {
      parallels: steps(south, north),
      meridians: steps(padded.getWest(), padded.getEast()),
      west: padded.getWest(),
      east: padded.getEast(),
      labelLng: map.containerPointToLatLng([LABEL_INSET_PX, 0]).lng,
      labelLat: map.containerPointToLatLng([0, size.y - LABEL_INSET_PX]).lat,
    }
  }, [map, zoom, bounds])

  return (
    <>
      {parallels.map((m) => (
        <Polyline
          key={`lat${m}`}
          pane="graticule"
          positions={[
            [m / 60, west],
            [m / 60, east],
          ]}
          pathOptions={LINE_STYLE}
        />
      ))}
      {meridians.map((m) => (
        <Polyline
          key={`lng${m}`}
          pane="graticule"
          positions={[
            [-MAX_LAT, m / 60],
            [MAX_LAT, m / 60],
          ]}
          pathOptions={LINE_STYLE}
        />
      ))}
      {parallels.map((m) => (
        <Marker
          key={`lat-label${m}`}
          position={[m / 60, labelLng]}
          interactive={false}
          icon={label(formatLatitude(m), 'lat')}
        />
      ))}
      {meridians.map((m) => (
        <Marker
          key={`lng-label${m}`}
          position={[labelLat, m / 60]}
          interactive={false}
          icon={label(formatLongitude(m), 'lng')}
        />
      ))}
    </>
  )
}
