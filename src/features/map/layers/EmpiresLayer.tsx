import { useMemo } from 'react'
import { GeoJSON, Marker } from 'react-leaflet'
import L from 'leaflet'
import type { EmpireShape } from '@/data/empires'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { esc } from '@/lib/wiki-popup'
import { useMapViewport } from '@/hooks/useMapViewport'
import citiesSearchJson from '@/data/registry/cities-search.json'
import { imperialAnchors } from './imperialAnchors'

// labeled-city obstacles: the great cities carry their own labels, and an
// empire name straddling one reads as a collision (Ottoman/Prusa, 1453)
const CITY_OBSTACLES = citiesSearchJson as Array<{
  lat: number
  lng: number
  s: number
  e: number
}>

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

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

/** Cliopatria's memberOf is a semicolon list of parenthesized umbrellas,
 *  outermost first — "(Merovingian Empire);(Kingdom of the Franks)". The
 *  family is the outermost one; rendering the raw string leaks ");(". */
function parseFamily(memberOf?: string): string | undefined {
  if (!memberOf) return undefined
  const first = memberOf.split(';')[0]?.replace(/[()]/g, '').trim()
  return first && first.length > 2 ? first : undefined
}

/** Vassals wear their suzerain's hue with a per-member shade — feudal
 *  fragmentation reads as texture WITHIN a realm (France's duchies, the
 *  HRE minors, the taifas), not as unrelated confetti beside it. */
function polityColor(name: string, memberOf?: string): string {
  const family = parseFamily(memberOf) ?? name
  const base = POLITY_PALETTE[hashStr(family) % POLITY_PALETTE.length]
  if (family === name) return base
  // member shade: nudge lightness by a stable ±12% step
  const n = parseInt(base.slice(1), 16)
  const step = (hashStr(name) % 5) - 2 // -2..2
  const f = (v: number) => {
    const adj = v + step * 0.06 * (step > 0 ? 255 - v : v)
    return Math.max(0, Math.min(255, Math.round(adj)))
  }
  return `#${f(n >> 16)
    .toString(16)
    .padStart(2, '0')}${f((n >> 8) & 255)
    .toString(16)
    .padStart(2, '0')}${f(n & 255)
    .toString(16)
    .padStart(2, '0')}`
}

/** Border ink: the polity's own color darkened ~40% — the paper-atlas
 *  convention (crisp state edges, no added hue noise). */
function polityBorder(name: string, memberOf?: string): string {
  const hex = polityColor(name, memberOf)
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

/** Approximate rendered half-width of a polity name in px. Uppercase serif
 *  runs ~0.68em per glyph plus the tier's letter-spacing (kept in sync with
 *  the .empire-label CSS). The declutter must see real widths — a fixed
 *  110px box let PRINCIPALITY OF GALICIA-VOLHYNIA and PRINCIPALITY OF
 *  PEREYASLAVL print through each other at 1223. */
function labelHalfWidth(name: string, area: number): number {
  const tier = labelTier(area)
  const [size, tracking] =
    tier === 'empire-label--vast'
      ? [17, 0.34]
      : tier === 'empire-label--large'
        ? [14, 0.26]
        : [11, 0.22]
  return (name.length * size * (0.68 + tracking)) / 2
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

  const currentYearForObstacles = useTimelineStore((s) => s.currentYear)
  const labeled = useMemo(() => {
    const min = labelMinArea(zoom)
    const candidates = visible.filter((e) => e.area >= min).sort((a, b) => b.area - a.area)
    // Collision space must BE screen space (Web Mercator): linear-lat y
    // compressed vertical distances ~1.6x at Baltic latitudes, so labels
    // 60px apart on screen read as "same row" and suppressed each other.
    const worldPx = 256 * 2 ** zoom
    const pxPerDegX = worldPx / 360
    const mercX = (lng: number) => lng * pxPerDegX
    const mercY = (lat: number) => {
      const s = Math.sin((lat * Math.PI) / 180)
      return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * worldPx
    }
    const obstacles = CITY_OBSTACLES.filter(
      (c) => c.s <= currentYearForObstacles && c.e >= currentYearForObstacles,
    ).map((c) => [mercX(c.lng), mercY(c.lat)])
    // Greedy declutter: biggest polities claim label space first; anything
    // whose anchor would land within ~1 label-height x ~8em of a placed
    // label is suppressed at this zoom (it reappears when zooming in).
    // Synthesize FAMILY labels: vassal realms (France's duchies, the HRE
    // minors) share a suzerain in memberOf but the umbrella polity itself
    // is a meta-entry dropped at ingest — so the realm was colored as one
    // but nameless. The family name renders at the members' area-weighted
    // center, sized by their combined area, unless a real polity already
    // carries that name.
    const realByName = new Map(visible.map((v) => [v.name, v]))
    const families = new Map<string, { area: number; lat: number; lng: number }>()
    for (const v of visible) {
      const fam = parseFamily(v.memberOf)
      if (!fam || fam === v.name) continue
      const f = families.get(fam) ?? { area: 0, lat: 0, lng: 0 }
      f.area += v.area
      f.lat += v.label[0] * v.area
      f.lng += v.label[1] * v.area
      families.set(fam, f)
    }
    // the suzerain itself joins its family (the Capetian royal domain is
    // tiny — the KINGDOM is the realm); skip only when the real polity is
    // big enough to have labeled itself anyway
    for (const [fam, f] of families) {
      const real = realByName.get(fam)
      if (real) {
        if (real.area >= min) {
          families.delete(fam)
        } else {
          f.area += real.area
          f.lat += real.label[0] * real.area
          f.lng += real.label[1] * real.area
        }
      }
    }
    const famCandidates = [...families.entries()]
      .filter(([, f]) => f.area >= min)
      .map(([name, f]) => ({
        id: `family-${name}`,
        name,
        area: f.area,
        label: [f.lat / f.area, f.lng / f.area] as [number, number],
      }))
      .sort((a, b) => b.area - a.area)

    const placed: Array<[number, number, number]> = [] // x, y, half-width px
    // The territory layer prints ROME / BYZANTINE EMPIRE at fixed anchors
    // (shared imperialAnchors.ts). Seed them as PLACED
    // labels so colliding polity names are suppressed, not nudged — at
    // 1223 'LATIN EMPIRE' printed straight through 'BYZANTINE EMPIRE'.
    // Vast-tier names are ~3 boxes wide: claim a horizontal spread.
    for (const [alat, alng] of imperialAnchors(currentYearForObstacles)) {
      for (const dx of [-99, 0, 99]) {
        placed.push([mercX(alng) + dx, mercY(alat), 110])
      }
    }
    const out: Array<{ e: EmpireShape; dodge: number }> = []
    for (const e of [...famCandidates, ...candidates] as EmpireShape[]) {
      const x = mercX(e.label[1])
      let y = mercY(e.label[0])
      const halfW = labelHalfWidth(e.name, e.area)
      if (placed.some(([px, py, pw]) => Math.abs(px - x) < pw + halfW && Math.abs(py - y) < 26))
        continue
      // dodge a labeled city sitting inside the name's box: nudge north
      let dodge = 0
      if (obstacles.some(([ox, oy]) => Math.abs(ox - x) < halfW && Math.abs(oy - y) < 22)) {
        // ~18px screen north, converted to degrees at this latitude
        dodge = (18 * Math.cos((e.label[0] * Math.PI) / 180)) / pxPerDegX
        y -= 18
      }
      placed.push([x, y, halfW])
      out.push({ e, dodge })
    }
    return out
  }, [visible, zoom, currentYearForObstacles])

  return (
    <>
      {visible.map((e) => {
        const color = polityColor(e.name, e.memberOf)
        return (
          <GeoJSON
            key={e.id}
            data={e.geometry as GeoJSON.GeometryObject}
            pane="empiresFill"
            style={{
              color: polityBorder(e.name, e.memberOf),
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
      {labeled.map(({ e, dodge }) => (
        <Marker
          key={`label-${e.id}`}
          position={[e.label[0] + dodge, e.label[1]]}
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
