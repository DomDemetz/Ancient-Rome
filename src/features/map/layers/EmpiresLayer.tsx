import { useMemo } from 'react'
import { GeoJSON, Marker } from 'react-leaflet'
import L from 'leaflet'
import type { EmpireShape } from '@/data/empires'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { esc } from '@/lib/wiki-popup'
import { useMapViewport } from '@/hooks/useMapViewport'

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

/** Minimum polity area (km²) that earns a name label at a given zoom. */
function labelMinArea(zoom: number): number {
  if (zoom <= 3) return 700000
  if (zoom === 4) return 250000
  if (zoom === 5) return 90000
  if (zoom === 6) return 30000
  return 0
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
  const { zoom } = useMapViewport()

  const visible = useMemo(
    () => data.filter((e) => e.from <= currentYear && e.to >= currentYear),
    [data, currentYear],
  )

  const labeled = useMemo(() => {
    const min = labelMinArea(zoom)
    const candidates = visible.filter((e) => e.area >= min).sort((a, b) => b.area - a.area)
    // Greedy declutter: biggest polities claim label space first; anything
    // whose anchor would land within ~1 label-height x ~8em of a placed
    // label is suppressed at this zoom (it reappears when zooming in).
    const pxPerDegX = (256 * 2 ** zoom) / 360
    const placed: Array<[number, number]> = []
    const out: EmpireShape[] = []
    for (const e of candidates) {
      const x = e.label[1] * pxPerDegX * Math.cos((e.label[0] * Math.PI) / 180)
      const y = e.label[0] * pxPerDegX
      if (placed.some(([px, py]) => Math.abs(px - x) < 110 && Math.abs(py - y) < 26)) continue
      placed.push([x, y])
      out.push(e)
    }
    return out
  }, [visible, zoom])

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
                  (e.wp || e.qid
                    ? `<button class="map-tooltip-readmore" data-wiki-id="${e.id}" data-wiki-layer="empires" data-entity-id="${e.id}">Read more</button>`
                    : ''),
                { closeButton: false },
              )
            }}
          />
        )
      })}
      {labeled.map((e) => (
        <Marker
          key={`label-${e.id}`}
          position={e.label}
          interactive={false}
          icon={L.divIcon({
            className: 'empire-label-wrap',
            html: `<div class="empire-label" style="color:${polityColor(e.name)}">${esc(e.name)}</div>`,
            iconSize: [0, 0],
          })}
        />
      ))}
    </>
  )
}
