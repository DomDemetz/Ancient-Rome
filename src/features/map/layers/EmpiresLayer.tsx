import { useEffect, useMemo } from 'react'
import { GeoJSON, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { EmpireShape } from '@/data/empires'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useMapLayerStore } from '@/stores/useMapLayerStore'
import { buildPopup, esc } from '@/lib/wiki-popup'
import { useMapViewport } from '@/hooks/useMapViewport'
import { imperialAnchors } from './imperialAnchors'
import { labelHalfWidth, labelProjector, labelTier } from './labelCollision'
import { popAt } from './populationCurve'

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
  const map = useMap()

  const visible = useMemo(
    () => data.filter((e) => e.from <= currentYear && e.to >= currentYear),
    [data, currentYear],
  )

  // Click resolution at the MAP level. The canvas-renderer perf work stacks
  // one full-viewport canvas per pane; the markers' canvas sits above this
  // pane and swallows the DOM click when its own hit-test misses — Leaflet
  // never forwards it down to our polygons. So when a click reaches the map
  // unclaimed, ray-cast it against the visible polities ourselves. Smallest
  // polity wins: a vassal duchy opens instead of the empire that contains it.
  useEffect(() => {
    const inRing = (lng: number, lat: number, ring: number[][]) => {
      let inside = false
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i]
        const [xj, yj] = ring[j]
        if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)
          inside = !inside
      }
      return inside
    }
    const inGeometry = (lng: number, lat: number, g: GeoJSON.GeometryObject): boolean => {
      if (g.type === 'Polygon')
        return (
          inRing(lng, lat, g.coordinates[0] as number[][]) &&
          !(g.coordinates as number[][][]).slice(1).some((h) => inRing(lng, lat, h))
        )
      if (g.type === 'MultiPolygon')
        return (g.coordinates as number[][][][]).some(
          (poly) => inRing(lng, lat, poly[0]) && !poly.slice(1).some((h) => inRing(lng, lat, h)),
        )
      return false
    }
    // layers that bubble (provinces) open their popup before the map click
    // lands here — don't clobber a popup another layer just opened
    let lastPopupOpen = 0
    const onPopupOpen = () => {
      lastPopupOpen = Date.now()
    }
    map.on('popupopen', onPopupOpen)
    const onClick = (ev: L.LeafletMouseEvent) => {
      if (Date.now() - lastPopupOpen < 150) return
      // a marker/popup click was already claimed upstream
      const src = ev.originalEvent.target as HTMLElement | null
      if (src?.closest('.leaflet-popup, .leaflet-marker-icon')) return
      const { lat, lng } = ev.latlng
      const hits = visible.filter((e) => inGeometry(lng, lat, e.geometry as GeoJSON.GeometryObject))
      if (!hits.length) return
      const e = hits.sort((a, b) => a.area - b.area)[0]
      L.popup({ closeButton: false })
        .setLatLng(ev.latlng)
        .setContent(
          buildPopup({
            title: e.name,
            details: [`${fmtYear(e.from)} – ${fmtYear(e.to)}`],
            readMore:
              e.wp || e.qid
                ? { id: e.id, layer: 'empires', entityId: e.id, label: 'Read more' }
                : undefined,
          }),
        )
        .openOn(map)
    }
    map.on('click', onClick)
    return () => {
      map.off('click', onClick)
      map.off('popupopen', onPopupOpen)
    }
  }, [map, visible])

  const currentYearForObstacles = useTimelineStore((s) => s.currentYear)
  const placesData = useMapLayerStore((s) => s.placesData)
  const labeled = useMemo(() => {
    const min = labelMinArea(zoom)
    const candidates = visible.filter((e) => e.area >= min).sort((a, b) => b.area - a.area)
    const { pxPerDegX, x: mercX, y: mercY } = labelProjector(zoom)
    // Dodge obstacles are the cities that ACTUALLY print a label right now —
    // the same population gate PlacesLayer renders with. A static all-cities
    // registry here made every empire name dodge phantom (unlabeled) cities,
    // scattering names off their anchors and sometimes ONTO a real label
    // (Duchy of Burgundy fled a phantom straight onto Paris, 1453).
    const labelPop = zoom <= 4 ? 250000 : 120000
    const obstacles: Array<[number, number]> = []
    for (const p of placesData ?? []) {
      if (!p.populations?.length) continue
      const cur = popAt(p.populations, currentYearForObstacles)
      if (cur != null && cur >= labelPop) obstacles.push([mercX(p.lng), mercY(p.lat)])
    }
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
      // dodge a labeled city sitting inside the name's box FIRST, so the
      // label-collision test below judges the FINAL position (a blind
      // post-test nudge re-created the overlaps it was meant to fix).
      // The city's own label extends ~45px around its dot — collision space
      // is the SUM of both boxes (Constantinople clipped LATIN EMPIRE's
      // tail from 74px away). Nudge AWAY from the city: north when the
      // city is south of the name, south when it's north (Fez sat above
      // ALMOHAD CALIPHATE; always-north walked the name INTO it).
      let dodge = 0
      // The city's text rides ABOVE its dot, so the pair needs more vertical
      // clearance than the label boxes alone: 26px still let HAMDANID
      // EMIRATES kiss Samarra (1000) and LATIN EMPIRE kiss Constantinople
      // (1223) — widen the trigger window and step far enough to clear the
      // city text, not just the dot.
      const hit = obstacles.find(
        ([ox, oy]) => Math.abs(ox - x) < halfW + 45 && Math.abs(oy - y) < 38,
      )
      if (hit) {
        const step = hit[1] >= y ? -44 : 44 // screen-north is -y
        dodge = (-step * Math.cos((e.label[0] * Math.PI) / 180)) / pxPerDegX
        y += step
      }
      // +14px breathing margin: boxes that merely didn't overlap still read
      // as one run-on name (GHASSANIDS LAKHMID KINGDOM, 550)
      if (
        placed.some(([px, py, pw]) => Math.abs(px - x) < pw + halfW + 14 && Math.abs(py - y) < 26)
      )
        continue
      placed.push([x, y, halfW])
      out.push({ e, dodge })
    }
    return out
  }, [visible, zoom, currentYearForObstacles, placesData])

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
            // clicks resolve at the map level (see the effect above): the
            // stacked per-pane canvases can't hit-test through each other
            interactive={false}
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
