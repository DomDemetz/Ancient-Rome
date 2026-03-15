import { useMemo, useState, useCallback } from 'react'
import { CircleMarker, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import type { Legion } from '@/data/legions'
import { useTimelineStore } from '@/stores/useTimelineStore'

interface LegionDeploymentLayerProps {
  data: Legion[]
}

const SYMBOL_COLORS: Record<string, string> = {
  bull: '#c0392b',
  eagle: '#d4af37',
  boar: '#8b4513',
  capricorn: '#2980b9',
  pegasus: '#9b59b6',
  lion: '#e67e22',
  thunderbolt: '#f1c40f',
  elephant: '#7f8c8d',
  wolf: '#6c757d',
  ram: '#e74c3c',
  galley: '#3498db',
}

function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year)} BC`
  return `${year} AD`
}

export function LegionDeploymentLayer({ data }: LegionDeploymentLayerProps) {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())
  const [bounds, setBounds] = useState(map.getBounds())
  const currentYear = useTimelineStore((s) => s.currentYear)

  const updateView = useCallback(() => {
    setZoom(map.getZoom())
    setBounds(map.getBounds())
  }, [map])

  useMapEvents({
    zoomend: updateView,
    moveend: updateView,
  })

  // Compute active bases for current year
  const activeBases = useMemo(() => {
    const result: Array<{
      legion: Legion
      base: Legion['bases'][number]
    }> = []

    for (const legion of data) {
      // Check if legion exists at current year
      if (legion.founded > currentYear) continue
      if (legion.dissolved != null && legion.dissolved < currentYear) continue

      // Find the current base
      const activeBase = legion.bases.find(
        (b) => b.fromYear <= currentYear && b.toYear >= currentYear,
      )
      if (!activeBase) continue

      // Bounds filtering
      if (zoom >= 7) {
        if (
          activeBase.lat < bounds.getSouth() ||
          activeBase.lat > bounds.getNorth() ||
          activeBase.lng < bounds.getWest() ||
          activeBase.lng > bounds.getEast()
        )
          continue
      }

      result.push({ legion, base: activeBase })
    }

    return result
  }, [data, currentYear, zoom, bounds])

  const baseRadius = zoom >= 7 ? 6 : zoom >= 5 ? 5 : 4

  return (
    <>
      {activeBases.map(({ legion, base }) => {
        const color = SYMBOL_COLORS[legion.symbol ?? ''] || '#c0392b'

        const tooltipLines = [
          legion.name,
          `Base: ${base.location}`,
          `${formatYear(base.fromYear)} \u2013 ${formatYear(base.toYear)}`,
          `Status: ${legion.status}`,
          legion.description,
        ]

        return (
          <CircleMarker
            key={legion.id}
            center={[base.lat, base.lng]}
            radius={baseRadius}
            pathOptions={{
              color: '#000',
              weight: 1.5,
              fillColor: color,
              fillOpacity: 0.9,
            }}
            bubblingMouseEvents={false}
          >
            <Tooltip direction="top" offset={[0, -4]}>
              <span style={{ whiteSpace: 'pre-line' }}>{tooltipLines.join('\n')}</span>
            </Tooltip>
          </CircleMarker>
        )
      })}
    </>
  )
}
