import { useMemo, useState, useCallback } from 'react'
import { CircleMarker, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import type { Battle } from '@/data/battles'
import { useTimelineStore } from '@/stores/useTimelineStore'

interface BattleLayerProps {
  data: Battle[]
}

const OUTCOME_COLORS: Record<string, string> = {
  victory: '#27ae60',
  defeat: '#e74c3c',
  draw: '#f39c12',
  unknown: '#95a5a6',
}

function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year)} BC`
  return `${year} AD`
}

function buildTooltip(b: Battle): string {
  const lines: string[] = [`Battle of ${b.name}`, formatYear(b.year), b.combatants]
  if (b.commander) lines.push(`Commander: ${b.commander}`)
  lines.push(`Outcome: ${b.outcome}`)
  if (b.description) lines.push(b.description)
  return lines.join('\n')
}

export function BattleLayer({ data }: BattleLayerProps) {
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

  const visible = useMemo(() => {
    return data.filter((b) => {
      // Show battles that occurred at or before the current year
      if (b.year > currentYear) return false

      // Bounds filtering at zoomed-in levels
      if (zoom >= 7) {
        return (
          b.lat >= bounds.getSouth() &&
          b.lat <= bounds.getNorth() &&
          b.lng >= bounds.getWest() &&
          b.lng <= bounds.getEast()
        )
      }

      return true
    })
  }, [data, zoom, bounds, currentYear])

  const baseRadius = zoom >= 7 ? 5 : zoom >= 5 ? 4 : 3

  return (
    <>
      {visible.map((b) => {
        const color = OUTCOME_COLORS[b.outcome] || OUTCOME_COLORS.unknown
        // Recent battles (within 50 years) are brighter
        const isRecent = currentYear - b.year < 50
        const opacity = isRecent ? 0.95 : 0.6

        return (
          <CircleMarker
            key={b.id}
            center={[b.lat, b.lng]}
            radius={baseRadius}
            pathOptions={{
              color: '#000',
              weight: 1,
              fillColor: color,
              fillOpacity: opacity,
            }}
            bubblingMouseEvents={false}
          >
            <Tooltip direction="top" offset={[0, -4]}>
              <span style={{ whiteSpace: 'pre-line' }}>{buildTooltip(b)}</span>
            </Tooltip>
          </CircleMarker>
        )
      })}
    </>
  )
}
