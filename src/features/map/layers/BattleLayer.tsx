import { useMemo } from 'react'
import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import type { Battle } from '@/data/battles'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useWikiEnrichment } from '@/hooks/useWikiEnrichment'
import { appendWikiTooltip, appendCrossRefTooltip, esc } from '@/lib/wiki-popup'
import { formatYear } from '@/lib/geo'
import { useMapViewport } from '@/hooks/useMapViewport'
import { battleVisibilityWindow } from './battleWindow'

interface BattleLayerProps {
  data: Battle[]
}

// Muted war inks in the atlas's earth register — flat-UI green/red dots
// vanished against the terrain and read as a different product.
const OUTCOME_COLORS: Record<string, string> = {
  victory: '#7fa653',
  defeat: '#c05548',
  draw: '#c2913e',
  unknown: '#97948a',
}

function buildTooltipHtml(b: Battle): string {
  // Only bare toponyms ("Artaxata") earn a "Battle of" prefix. Every
  // multi-word name in the dataset already describes its event — the old
  // startsWith check produced "Battle of Battle near Burdigala",
  // "Battle of Fall of Constantinople", "Battle of Pompey's Pirate War".
  const title = /\s/.test(b.name) ? b.name : `Battle of ${b.name}`
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
  html: '<div class="battle-flash" style="width:12px;height:12px;background:rgba(192,85,72,0.9);border-radius:50%;"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})

/** Compute opacity for a past battle based on age relative to visibility window */
function battleOpacity(age: number, window: number): number {
  const freshZone = Math.max(1, window * 0.2)
  if (age < freshZone) return 0.95
  // floor at 0.5: a battle inside its window must stay legible — the old
  // 0.30 tail left "BATTLES 40" claiming dots nobody could find
  return 0.95 - ((age - freshZone) / (window - freshZone)) * 0.45
}

export function BattleLayer({ data }: BattleLayerProps) {
  const { zoom, bounds } = useMapViewport()
  const currentYear = useTimelineStore((s) => s.currentYear)
  const playing = useTimelineStore((s) => s.playing)
  const speed = useTimelineStore((s) => s.speed)
  // crossRef comes from the graph-keyed features store (same object,
  // no 14.4 MB legacy cross-reference load)
  const featKnowledge = useWikiEnrichment('knowledge-features')

  const visibilityWindow = battleVisibilityWindow(playing, speed)

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

  const baseRadius = zoom >= 7 ? 6 : zoom >= 5 ? 5 : 4

  return (
    <>
      {visible.map((b) => {
        const color = OUTCOME_COLORS[b.outcome] || OUTCOME_COLORS.unknown
        const age = currentYear - b.year
        const opacity = battleOpacity(age, visibilityWindow)
        // Battles are EVENTS, not places: a diamond (the cartographic
        // saltire, simplified) so they never read as settlement dots — a
        // whole screenshot session once misread the Cimbrian-War markers
        // as military settlements. Footprint matches the old circle.
        const side = baseRadius * 2 - 1
        return (
          <Marker
            key={b.id}
            position={[b.lat, b.lng]}
            icon={L.divIcon({
              className: '',
              html: `<div style="width:${side}px;height:${side}px;transform:rotate(45deg);background:${color};opacity:${opacity};border:1px solid rgba(26,18,12,0.85);border-radius:1px"></div>`,
              iconSize: [side, side],
              iconAnchor: [side / 2, side / 2],
            })}
          >
            <Popup key={featKnowledge ? 'w' : 'p'} offset={[0, -4]} closeButton={false}>
              <span
                dangerouslySetInnerHTML={{
                  __html: (() => {
                    const hasWiki = featKnowledge?.[`battle:${b.id}`]
                    let html = appendWikiTooltip(
                      buildTooltipHtml(b),
                      `battle:${b.id}`,
                      featKnowledge,
                      'knowledge-features',
                    )
                    if (!hasWiki) {
                      const crKey = `battle:${b.id}`
                      const crEntry = featKnowledge?.[crKey]?.crossRef
                      if (crEntry) {
                        html = appendCrossRefTooltip(html, crEntry, { crKey })
                      }
                    }
                    return html
                  })(),
                }}
              />
            </Popup>
          </Marker>
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
