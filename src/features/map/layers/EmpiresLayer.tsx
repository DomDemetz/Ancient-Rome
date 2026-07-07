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

/**
 * Curated cartographic palette — muted earth-and-mineral tints that belong
 * to the atlas's amber-on-dark identity (a hashed hue wheel read like a
 * board game). Rome's imperial red band stays exclusive to the territory
 * layer. Assignment is stable per polity name across years and sessions.
 */
const POLITY_PALETTE = [
  '#b8966a', // ochre
  '#96a46b', // moss
  '#aa756e', // terracotta
  '#7c98aa', // slate blue
  '#a488b8', // dusty violet
  '#6fa89a', // verdigris
  '#b8a16a', // sand
  '#8a9679', // olive drab
  '#af8c79', // clay
  '#6b96a4', // petrol
  '#9a87a8', // heather
  '#7caa85', // sage
  '#bc968d', // rosewood
  '#87a4b8', // haze blue
  '#a8966f', // bronze
  '#79969a', // pewter
]

function polityColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return POLITY_PALETTE[h % POLITY_PALETTE.length]
}

/** Border ink: the polity's own color darkened ~40% — the paper-atlas
 *  convention (crisp state edges, no added hue noise). */
function polityBorder(name: string): string {
  const hex = polityColor(name)
  const n = parseInt(hex.slice(1), 16)
  const d = (v: number) => Math.round(v * 0.58)
  return `rgb(${d(n >> 16)}, ${d((n >> 8) & 255)}, ${d(n & 255)})`
}

/** Cartographic type tiers: the size of the name encodes the size of the
 *  state — great empires speak louder than duchies. */
function labelTier(area: number): string {
  if (area >= 2000000) return 'empire-label--vast'
  if (area >= 600000) return 'empire-label--large'
  return ''
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
              color: polityBorder(e.name),
              weight: 1.6,
              opacity: 0.65,
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
            html: `<div class="empire-label ${labelTier(e.area)}">${esc(e.name)}</div>`,
            iconSize: [0, 0],
          })}
        />
      ))}
    </>
  )
}
