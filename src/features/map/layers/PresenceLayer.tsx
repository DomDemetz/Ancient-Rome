import { useEffect, useMemo } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { useTimelineStore } from '@/stores/useTimelineStore'

export interface PresenceGrid {
  cellSize: number
  years: number[]
  cells: Array<{ lat: number; lng: number; w: number[] }>
}

interface PresenceLayerProps {
  data: PresenceGrid
}

const COLOR = [212, 167, 74] // warm amber RGB

export function PresenceLayer({ data }: PresenceLayerProps) {
  const map = useMap()
  const currentYear = useTimelineStore((s) => s.currentYear)

  // Find the nearest time snapshot index
  const yearIndex = useMemo(() => {
    let best = 0
    let bestDist = Math.abs(data.years[0] - currentYear)
    for (let i = 1; i < data.years.length; i++) {
      const dist = Math.abs(data.years[i] - currentYear)
      if (dist < bestDist) {
        bestDist = dist
        best = i
      }
    }
    return best
  }, [data.years, currentYear])

  // Compute max weight for this snapshot for normalization
  const maxWeight = useMemo(() => {
    let max = 1
    for (const cell of data.cells) {
      if (cell.w[yearIndex] > max) max = cell.w[yearIndex]
    }
    return max
  }, [data.cells, yearIndex])

  useEffect(() => {
    const canvasRenderer = L.canvas({ pane: 'overlayPane' })
    const rectangles: L.Rectangle[] = []

    for (const cell of data.cells) {
      const weight = cell.w[yearIndex]
      if (weight <= 0) continue

      const normalized = weight / maxWeight
      const opacity = 0.15 + normalized * 0.45 // 15% to 60%

      const bounds: L.LatLngBoundsExpression = [
        [cell.lat, cell.lng],
        [cell.lat + data.cellSize, cell.lng + data.cellSize],
      ]

      const rect = L.rectangle(bounds, {
        renderer: canvasRenderer,
        stroke: false,
        fillColor: `rgb(${COLOR[0]}, ${COLOR[1]}, ${COLOR[2]})`,
        fillOpacity: opacity,
        interactive: false,
      })

      rect.addTo(map)
      rectangles.push(rect)
    }

    return () => {
      for (const rect of rectangles) {
        rect.remove()
      }
    }
  }, [map, data, yearIndex, maxWeight])

  return null
}
