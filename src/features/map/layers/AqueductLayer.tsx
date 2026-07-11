import { useMemo } from 'react'
import { GeoJSON } from 'react-leaflet'
import type { FeatureCollection, Feature } from 'geojson'
import type { PathOptions } from 'leaflet'
import L from 'leaflet'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { buildPopup } from '@/lib/wiki-popup'
import { filterWithSignature } from '@/lib/feature-signature'

/**
 * Aqueduct LINES (AWMC channel geometry). Aqueduct point entities render
 * through the atlas kind toggle like every other structure — this layer
 * owns only what the atlas can't: the engineered line courses.
 */
interface AqueductLayerProps {
  lines?: FeatureCollection | null
}

const LINE_STYLE: PathOptions = {
  color: '#3498db',
  weight: 2,
  opacity: 0.7,
}

function onEachAqueductLine(feature: Feature, layer: L.Layer) {
  const name = feature.properties?.name
  if (name) {
    ;(layer as L.Path).bindPopup(buildPopup({ title: name }))
  }
}

export function AqueductLayer({ lines }: AqueductLayerProps) {
  const currentYear = useTimelineStore((s) => s.currentYear)

  // Filter AWMC aqueduct lines by temporal data
  const { filteredLines, linesSig } = useMemo(() => {
    if (!lines) {
      return { filteredLines: null, linesSig: '0:0' }
    }
    const { features, sig } = filterWithSignature(lines.features, (f) => {
      const start = f.properties?.startYear
      const end = f.properties?.endYear
      if (start != null && start !== 0 && start > currentYear) return false
      if (end != null && end !== 0 && end < currentYear) return false
      return true
    })
    return { filteredLines: { ...lines, features }, linesSig: sig }
  }, [lines, currentYear])

  return (
    <>
      {filteredLines && (
        <GeoJSON
          key={linesSig}
          data={filteredLines}
          style={LINE_STYLE}
          onEachFeature={onEachAqueductLine}
        />
      )}
    </>
  )
}
