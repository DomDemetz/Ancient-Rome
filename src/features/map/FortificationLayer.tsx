import { GeoJSON } from 'react-leaflet'
import type { FeatureCollection, Feature } from 'geojson'
import type { PathOptions } from 'leaflet'
import L from 'leaflet'
import { esc } from '@/lib/wiki-popup'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useMemo, useCallback } from 'react'

interface FortificationLayerProps {
  data: FeatureCollection
}

function shouldShowFortification(props: Record<string, unknown>, currentYear: number): boolean {
  const territoryYear = props.territoryYear as number | null
  if (territoryYear == null) return false
  // Visible 20 years after territory control (construction delay)
  if (currentYear < territoryYear + 20) return false
  // Decline: hidden 50 years after territory loss
  const declineYear = props.declineYear as number | null
  if (declineYear != null && currentYear > declineYear + 50) return false
  return true
}

function getFortificationOpacity(props: Record<string, unknown>, currentYear: number): number {
  const territoryYear = (props.territoryYear as number | null) ?? 0
  const visYear = territoryYear + 20
  // Fade-in over 30 years
  const fadeIn = Math.min(1, Math.max(0, (currentYear - visYear) / 30))
  let opacity = 0.8 * fadeIn
  // Decline over 50 years
  const declineYear = props.declineYear as number | null
  if (declineYear != null && currentYear > declineYear) {
    const decay = Math.min(1, (currentYear - declineYear) / 50)
    opacity *= 1 - decay
  }
  return opacity
}

export function FortificationLayer({ data }: FortificationLayerProps) {
  const currentYear = useTimelineStore((s) => s.currentYear)

  const filtered = useMemo(() => {
    const features = data.features.filter((f) =>
      shouldShowFortification(f.properties || {}, currentYear),
    )
    return { ...data, features }
  }, [data, currentYear])

  const getStyle = useCallback(
    (feature: Feature | undefined): PathOptions => {
      const props = feature?.properties || {}
      const opacity = getFortificationOpacity(props, currentYear)
      const declineYear = props.declineYear as number | null
      const inDecline = declineYear != null && currentYear > declineYear
      return {
        color: '#e67e22',
        weight: 2.5,
        opacity,
        dashArray: inDecline ? '4 6' : '2 4',
      }
    },
    [currentYear],
  )

  const onEachFortification = useCallback((feature: Feature, layer: L.Layer) => {
    const name = feature.properties?.name
    if (name) {
      ;(layer as L.Path).bindPopup(`<div class="map-tooltip-title">${esc(name)}</div>`)
    }
  }, [])

  return (
    <GeoJSON
      key={`fortifications-${currentYear}`}
      data={filtered}
      style={getStyle}
      onEachFeature={onEachFortification}
    />
  )
}
