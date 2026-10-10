import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { greatCircleMeters, greatCirclePath, distanceLabels, type LatLngPair } from '@/lib/measure'

const LINE_STYLE: L.PathOptions = { color: '#fbbf24', weight: 2, interactive: false }
const END_STYLE: L.PathOptions = {
  color: '#0a0a0c',
  weight: 1.5,
  fillColor: '#fbbf24',
  fillOpacity: 1,
  interactive: false,
}

/**
 * Two-point ruler. First click drops a pin, the line follows the pointer,
 * the second click fixes it; a third starts over. The distance is the great
 * circle between the points — exact at any zoom and latitude — and the line
 * drawn is that same path, which is why long ones bow slightly northward.
 */
export function Ruler() {
  const map = useMap()
  const [points, setPoints] = useState<LatLngPair[]>([])
  const [pointer, setPointer] = useState<LatLngPair | null>(null)

  useEffect(() => {
    const container = map.getContainer()
    container.classList.add('ruler-active')
    // two quick clicks are two points, not a zoom
    const hadDoubleClickZoom = map.doubleClickZoom.enabled()
    map.doubleClickZoom.disable()
    return () => {
      container.classList.remove('ruler-active')
      if (hadDoubleClickZoom) map.doubleClickZoom.enable()
    }
  }, [map])

  useMapEvents({
    click(e) {
      const p: LatLngPair = [e.latlng.lat, e.latlng.lng]
      setPoints((prev) => (prev.length === 1 ? [prev[0], p] : [p]))
      setPointer(null)
    },
    mousemove(e) {
      if (points.length === 1) setPointer([e.latlng.lat, e.latlng.lng])
    },
  })

  const end = points[1] ?? pointer
  const measured = useMemo(() => {
    if (!points[0] || !end) return null
    const path = greatCirclePath(points[0], end)
    const d = distanceLabels(greatCircleMeters(points[0], end))
    return {
      path,
      mid: path[Math.floor(path.length / 2)],
      icon: L.divIcon({
        className: 'graticule-label-wrap',
        html: `<div class="ruler-label"><b>${d.km}</b>${d.mi} · ${d.roman}</div>`,
        iconSize: [0, 0],
      }),
    }
  }, [points, end])

  return (
    <>
      {measured && (
        <>
          <Polyline
            pane="ruler"
            positions={measured.path}
            pathOptions={{ ...LINE_STYLE, dashArray: points[1] ? undefined : '6 6' }}
          />
          <Marker pane="ruler" position={measured.mid} interactive={false} icon={measured.icon} />
        </>
      )}
      {points.map((p, i) => (
        <CircleMarker key={i} pane="ruler" center={p} radius={5} pathOptions={END_STYLE} />
      ))}
    </>
  )
}
