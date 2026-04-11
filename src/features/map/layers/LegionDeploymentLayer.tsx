import { useMemo } from 'react'
import { CircleMarker, Popup } from 'react-leaflet'
import type { Legion } from '@/data/legions'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useWikiEnrichment } from '@/hooks/useWikiEnrichment'
import { appendWikiTooltip, esc } from '@/lib/wiki-popup'
import { formatYear } from '@/lib/geo'
import { useMapViewport } from '@/hooks/useMapViewport'

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

export function LegionDeploymentLayer({ data }: LegionDeploymentLayerProps) {
  const { zoom, bounds } = useMapViewport()
  const currentYear = useTimelineStore((s) => s.currentYear)
  const wikiLookup = useWikiEnrichment('legions')

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

        let tooltipHtml = `<div class="map-tooltip-title">${esc(legion.name)}</div>`
        tooltipHtml += `<div class="map-tooltip-sub">${esc(base.location)} · ${esc(legion.status)}</div>`
        const details: string[] = [`${formatYear(base.fromYear)} \u2013 ${formatYear(base.toYear)}`]
        if (legion.description) details.push(esc(legion.description))
        tooltipHtml += `<div class="map-tooltip-detail">${details.join(' · ')}</div>`

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
            <Popup key={wikiLookup ? 'w' : 'p'} offset={[0, -4]} closeButton={false}>
              <span
                dangerouslySetInnerHTML={{
                  __html: appendWikiTooltip(tooltipHtml, legion.id, wikiLookup, 'legions'),
                }}
              />
            </Popup>
          </CircleMarker>
        )
      })}
    </>
  )
}
