/** Measurement helpers shared by the graticule overlay and the scale legend. */

/** One Roman mile (mille passus) = 1,000 paces = 5,000 Roman feet. */
export const ROMAN_MILE_M = 1480
export const ROMAN_PACE_M = ROMAN_MILE_M / 1000
export const MILE_M = 1609.344
export const FOOT_M = 0.3048
/** Mean length of one degree of latitude — the same everywhere on the map. */
export const LAT_DEGREE_M = 111_130
const LNG_DEGREE_EQUATOR_M = 111_320

/**
 * Ground metres per screen pixel. Web Mercator stretches the map toward the
 * poles, so this is only true at the given latitude — the scale legend uses
 * the centre of the view and says so.
 */
export function metersPerPixel(lat: number, zoom: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom
}

/** Largest 1 / 2 / 5 × 10ⁿ that does not exceed `max`. */
export function niceNumber(max: number): number {
  const pow = 10 ** Math.floor(Math.log10(max))
  const lead = max / pow
  return (lead >= 5 ? 5 : lead >= 2 ? 2 : 1) * pow
}

// Grid spacings in arc-minutes (integers, so 41°30′ never becomes 41.4999°)
const GRID_STEPS_MIN = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1200, 1800]
const MIN_LINE_GAP_PX = 90

/** Graticule spacing in arc-minutes: the finest that keeps lines ≥ 90px apart. */
export function graticuleStepMinutes(zoom: number): number {
  const pxPerMinute = (256 * 2 ** zoom) / (360 * 60)
  return (
    GRID_STEPS_MIN.find((s) => s * pxPerMinute >= MIN_LINE_GAP_PX) ??
    GRID_STEPS_MIN[GRID_STEPS_MIN.length - 1]
  )
}

/** 2490 → "41°30′", 300 → "5°", 5 → "5′" (sign dropped — callers add N/S/E/W). */
export function formatArc(minutes: number): string {
  const abs = Math.abs(minutes)
  const deg = Math.floor(abs / 60)
  const min = abs % 60
  if (deg === 0 && min > 0) return `${min}′`
  return min ? `${deg}°${String(min).padStart(2, '0')}′` : `${deg}°`
}

export function formatLatitude(minutes: number): string {
  return minutes === 0 ? '0°' : `${formatArc(minutes)}${minutes > 0 ? 'N' : 'S'}`
}

export function formatLongitude(minutes: number): string {
  // the map can be panned past the antimeridian — fold back into ±180°
  const m = ((((minutes + 10800) % 21600) + 21600) % 21600) - 10800
  if (m === 0 || m === -10800) return formatArc(m)
  return `${formatArc(m)}${m > 0 ? 'E' : 'W'}`
}

/** Ground distance between neighbouring grid lines, north–south and east–west. */
export function gridCellMeters(stepMinutes: number, lat: number): { ns: number; ew: number } {
  const deg = stepMinutes / 60
  return {
    ns: deg * LAT_DEGREE_M,
    ew: deg * LNG_DEGREE_EQUATOR_M * Math.cos((lat * Math.PI) / 180),
  }
}

export interface ScaleRow {
  /** bar length in screen pixels */
  px: number
  label: string
}

function row(
  maxMeters: number,
  mpp: number,
  unitM: number,
  unit: string,
  subM: number,
  sub: string,
) {
  const big = maxMeters / unitM >= 1
  const size = big ? unitM : subM
  const n = niceNumber(maxMeters / size)
  return { px: (n * size) / mpp, label: `${n.toLocaleString('en-US')} ${big ? unit : sub}` }
}

/** The three bars of the scale legend, each the longest round number ≤ maxPx. */
export function scaleRows(lat: number, zoom: number, maxPx: number): ScaleRow[] {
  const mpp = metersPerPixel(lat, zoom)
  const max = mpp * maxPx
  return [
    row(max, mpp, 1000, 'km', 1, 'm'),
    row(max, mpp, MILE_M, 'mi', FOOT_M, 'ft'),
    row(max, mpp, ROMAN_MILE_M, 'Roman mi', ROMAN_PACE_M, 'Roman paces'),
  ]
}

/** 555_650 → "556 km", 820 → "820 m" */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  const km = meters / 1000
  return `${km < 10 ? km.toFixed(1) : Math.round(km).toLocaleString('en-US')} km`
}

const EARTH_RADIUS_M = 6_371_009
const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI

export type LatLngPair = [lat: number, lng: number]

/** Great-circle (straight-line over the globe) distance — exact anywhere on
 *  the map, unlike anything read off the screen with a scale bar. */
export function greatCircleMeters(a: LatLngPair, b: LatLngPair): number {
  const dLat = rad(b[0] - a[0])
  const dLng = rad(b[1] - a[1])
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Points along the great circle from a to b. On this projection the shortest
 *  path bows toward the pole, so the ruler draws the path it measures. */
export function greatCirclePath(a: LatLngPair, b: LatLngPair, segments = 48): LatLngPair[] {
  const d = greatCircleMeters(a, b) / EARTH_RADIUS_M
  if (d < 1e-9) return [a, b]
  const [lat1, lng1, lat2, lng2] = [a[0], a[1], b[0], b[1]].map(rad)
  const out: LatLngPair[] = []
  for (let i = 0; i <= segments; i++) {
    const f = i / segments
    const A = Math.sin((1 - f) * d) / Math.sin(d)
    const B = Math.sin(f * d) / Math.sin(d)
    const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2)
    const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2)
    const z = A * Math.sin(lat1) + B * Math.sin(lat2)
    let lng = deg(Math.atan2(y, x))
    // keep the line continuous when an endpoint sits on a wrapped world copy
    const prev = i === 0 ? a[1] : out[i - 1][1]
    lng += Math.round((prev - lng) / 360) * 360
    out.push([deg(Math.atan2(z, Math.hypot(x, y))), lng])
  }
  return out
}

function inUnit(meters: number, unitM: number, unit: string, subM: number, sub: string): string {
  const big = meters >= unitM
  const n = meters / (big ? unitM : subM)
  const text = n < 10 && big ? n.toFixed(1) : Math.round(n).toLocaleString('en-US')
  return `${text} ${big ? unit : sub}`
}

/** One distance, three ways: 589 km · 366 mi · 398 Roman mi. */
export function distanceLabels(meters: number): { km: string; mi: string; roman: string } {
  return {
    km: formatDistance(meters),
    mi: inUnit(meters, MILE_M, 'mi', FOOT_M, 'ft'),
    roman: inUnit(meters, ROMAN_MILE_M, 'Roman mi', ROMAN_PACE_M, 'Roman paces'),
  }
}
