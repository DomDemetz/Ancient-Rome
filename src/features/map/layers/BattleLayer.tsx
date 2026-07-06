import { useMemo } from 'react'
import { CircleMarker, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import type { Battle } from '@/data/battles'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useWikiEnrichment, useCrossRef } from '@/hooks/useWikiEnrichment'
import { appendWikiTooltip, esc } from '@/lib/wiki-popup'
import { formatYear } from '@/lib/geo'
import { useMapViewport } from '@/hooks/useMapViewport'

interface BattleLayerProps {
  data: Battle[]
}

const OUTCOME_COLORS: Record<string, string> = {
  victory: '#27ae60',
  defeat: '#e74c3c',
  draw: '#f39c12',
  unknown: '#95a5a6',
}

function buildTooltipHtml(b: Battle): string {
  const title =
    b.name.startsWith('Battle of') || b.name.startsWith('Siege of') ? b.name : `Battle of ${b.name}`
  let html = `<div class="map-tooltip-title">${esc(title)}</div>`
  html += `<div class="map-tooltip-sub">${formatYear(b.year)} · ${esc(b.combatants)}</div>`
  const details: string[] = []
  if (b.commander) details.push(`Commander: ${esc(b.commander)}`)
  details.push(`Outcome: ${esc(b.outcome)}`)
  if (details.length) html += `<div class="map-tooltip-detail">${details.join(' · ')}</div>`
  return html
}

const flashIcon = L.divIcon({
  className: '',
  html: '<div class="battle-flash" style="width:12px;height:12px;background:rgba(231,76,60,0.9);border-radius:50%;"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})

/** Compute opacity for a past battle based on age relative to visibility window */
function battleOpacity(age: number, window: number): number {
  const freshZone = Math.max(1, window * 0.2)
  if (age < freshZone) return 0.95
  return 0.95 - ((age - freshZone) / (window - freshZone)) * 0.65
}

export function BattleLayer({ data }: BattleLayerProps) {
  const { zoom, bounds } = useMapViewport()
  const currentYear = useTimelineStore((s) => s.currentYear)
  const playing = useTimelineStore((s) => s.playing)
  const speed = useTimelineStore((s) => s.speed)
  const wikiLookup = useWikiEnrichment('battles')
  const crossRef = useCrossRef()

  // Adaptive visibility window: tight when paused, wider at higher speeds
  const visibilityWindow = playing ? Math.min(50, Math.max(10, Math.round(speed * 12))) : 5

  // Adaptive visibility window for result markers
  const visible = useMemo(() => {
    return data.filter((b) => {
      if (b.year > currentYear) return false
      if (currentYear - b.year >= visibilityWindow) return false

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
  }, [data, zoom, bounds, currentYear, visibilityWindow])

  // Flash only at the exact battle year
  const flashBattles = useMemo(() => {
    return visible.filter((b) => currentYear === b.year)
  }, [visible, currentYear])

  const baseRadius = zoom >= 7 ? 5 : zoom >= 5 ? 4 : 3

  return (
    <>
      {visible.map((b) => {
        const color = OUTCOME_COLORS[b.outcome] || OUTCOME_COLORS.unknown
        const age = currentYear - b.year
        const opacity = battleOpacity(age, visibilityWindow)
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
            <Popup key={wikiLookup ? 'w' : 'p'} offset={[0, -4]} closeButton={false}>
              <span
                dangerouslySetInnerHTML={{
                  __html: (() => {
                    const hasWiki = wikiLookup?.[b.id]
                    let html = appendWikiTooltip(buildTooltipHtml(b), b.id, wikiLookup, 'battles')
                    if (!hasWiki) {
                      const crKey = `battle:${b.id}`
                      const crEntry = crossRef?.[crKey]
                      if (crEntry) {
                        html += `<div class="map-tooltip-wiki"><button class="map-tooltip-readmore" data-wiki-id="${esc(crKey)}" data-wiki-layer="crossref">Details</button></div>`
                      }
                    }
                    return html
                  })(),
                }}
              />
            </Popup>
          </CircleMarker>
        )
      })}
      {flashBattles.map((b) => (
        <Marker
          key={`flash-${b.id}-${currentYear}`}
          position={[b.lat, b.lng]}
          icon={flashIcon}
          interactive={false}
        />
      ))}
    </>
  )
}
