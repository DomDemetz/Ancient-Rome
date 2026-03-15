import { useMemo, useState, useCallback } from 'react'
import { CircleMarker, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
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

function buildTooltipHtml(b: Battle): string {
  let html = `<div class="map-tooltip-title">Battle of ${b.name}</div>`
  html += `<div class="map-tooltip-sub">${formatYear(b.year)} · ${b.combatants}</div>`
  const details: string[] = []
  if (b.commander) details.push(`Commander: ${b.commander}`)
  details.push(`Outcome: ${b.outcome}`)
  if (details.length) html += `<div class="map-tooltip-detail">${details.join(' · ')}</div>`
  return html
}

const flashIcon = L.divIcon({
  className: '',
  html: '<div class="battle-flash" style="width:12px;height:12px;background:rgba(231,76,60,0.9);border-radius:50%;"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})

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
      // 50-year visibility window
      if (b.year > currentYear) return false
      if (currentYear - b.year >= 50) return false

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

  // Battles in the 5-year flash window get a pulse animation overlay
  const flashBattles = useMemo(() => {
    return visible.filter((b) => currentYear - b.year < 5)
  }, [visible, currentYear])

  const baseRadius = zoom >= 7 ? 5 : zoom >= 5 ? 4 : 3

  return (
    <>
      {visible.map((b) => {
        const color = OUTCOME_COLORS[b.outcome] || OUTCOME_COLORS.unknown
        const age = currentYear - b.year
        const opacity = age < 10 ? 0.95 : 0.95 - (age - 10) * 0.02

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
            <Popup offset={[0, -4]} closeButton={false}>
              <span dangerouslySetInnerHTML={{ __html: buildTooltipHtml(b) }} />
            </Popup>
          </CircleMarker>
        )
      })}
      {flashBattles.map((b) => (
        <Marker
          key={`flash-${b.id}`}
          position={[b.lat, b.lng]}
          icon={flashIcon}
          interactive={false}
        />
      ))}
    </>
  )
}
