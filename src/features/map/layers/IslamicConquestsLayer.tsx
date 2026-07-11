import { GeoJSON } from 'react-leaflet'
import type { FeatureCollection, Feature } from 'geojson'
import type { PathOptions } from 'leaflet'
import L from 'leaflet'
import { buildPopup } from '@/lib/wiki-popup'
import { filterWithSignature } from '@/lib/feature-signature'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { inWindow } from './temporal'
import { useMemo } from 'react'

interface IslamicConquestsLayerProps {
  data: FeatureCollection
}

/** One green per conquest wave, dark (earliest) to light (latest) — the
 *  early core reads strongest, later waves layer outward around it. */
const PHASE_FILLS = ['#14532d', '#166534', '#15803d', '#4d7c0f', '#a3b18a']

function phaseStyle(feature?: Feature): PathOptions {
  const phase = (feature?.properties?.phase ?? 5) as number
  const fill = PHASE_FILLS[Math.max(0, Math.min(PHASE_FILLS.length - 1, phase - 1))]
  return {
    color: fill,
    weight: 1,
    opacity: 0.7,
    fillColor: fill,
    fillOpacity: 0.28,
    pane: 'basePolygons',
  }
}

function onEachPhase(feature: Feature, layer: L.Layer) {
  const { label } = feature.properties ?? {}
  if (label) {
    ;(layer as L.Path).bindPopup(
      buildPopup({
        title: 'Islamic Conquests',
        sub: label,
        source: 'DARMC / Mapping Past Societies',
      }),
    )
  }
}

export function IslamicConquestsLayer({ data }: IslamicConquestsLayerProps) {
  const currentYear = useTimelineStore((s) => s.currentYear)

  const { filtered, sig } = useMemo(() => {
    const { features, sig } = filterWithSignature(data.features, (f) => {
      const { startYear } = f.properties || {}
      return inWindow(startYear, undefined, currentYear)
    })
    return { filtered: { ...data, features }, sig }
  }, [data, currentYear])

  return (
    <GeoJSON
      key={`islamic-conquests-${sig}`}
      data={filtered}
      pane="basePolygons"
      bubblingMouseEvents
      style={phaseStyle}
      onEachFeature={onEachPhase}
    />
  )
}
