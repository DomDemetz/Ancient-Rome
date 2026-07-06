import { useMemo } from 'react'
import { GeoJSON } from 'react-leaflet'
import type { EmpireShape } from '@/data/empires'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { esc } from '@/lib/wiki-popup'

interface EmpiresLayerProps {
  data: EmpireShape[]
}

/** Stable, muted color per polity name — consistent across years and sessions. */
function polityColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  const hue = h % 360
  // avoid the empire-red band (~350–20) reserved for Rome's own territory
  const safeHue = hue > 340 || hue < 25 ? (hue + 60) % 360 : hue
  return `hsl(${safeHue}, 52%, 56%)`
}

function fmtYear(y: number): string {
  return y < 0 ? `${-y} BC` : `${y} AD`
}

/**
 * The world's polities (Cliopatria / Seshat, CC BY 4.0) — every state on
 * earth, each shape valid for [from, to]. Renders beneath Rome's curated
 * territory so the empire always reads on top of its world.
 */
export function EmpiresLayer({ data }: EmpiresLayerProps) {
  const currentYear = useTimelineStore((s) => s.currentYear)

  const visible = useMemo(
    () => data.filter((e) => e.from <= currentYear && e.to >= currentYear),
    [data, currentYear],
  )

  return (
    <>
      {visible.map((e) => {
        const color = polityColor(e.name)
        return (
          <GeoJSON
            key={e.id}
            data={e.geometry as GeoJSON.GeometryObject}
            pane="empiresFill"
            style={{
              color,
              weight: 1,
              opacity: 0.55,
              fillColor: color,
              fillOpacity: 1, // pane supplies the group translucency
              pane: 'empiresFill',
            }}
            onEachFeature={(_f, layer) => {
              layer.bindPopup(
                `<div class="map-tooltip-title">${esc(e.name)}</div>` +
                  `<div class="map-tooltip-detail">${fmtYear(e.from)} – ${fmtYear(e.to)}</div>` +
                  (e.wp
                    ? `<div class="map-tooltip-detail"><a href="https://en.wikipedia.org/wiki/${encodeURIComponent(e.wp.replace(/ /g, '_'))}" target="_blank" rel="noopener noreferrer">Wikipedia ↗</a></div>`
                    : e.qid
                      ? `<div class="map-tooltip-detail"><a href="https://www.wikidata.org/wiki/${e.qid}" target="_blank" rel="noopener noreferrer">Wikidata ↗</a></div>`
                      : ''),
                { closeButton: false },
              )
            }}
          />
        )
      })}
    </>
  )
}
