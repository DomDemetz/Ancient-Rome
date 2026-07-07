/** Screen-space (Web Mercator) projection for label collision tests.
 *  ONE source of truth — every layer that declutters labels must measure
 *  distances in the space the labels actually render in. The previous
 *  ad-hoc projection (linear-lat y, cos(lat)-scaled x) compressed
 *  vertical distances ~1.6x at Baltic latitudes and shrank horizontal
 *  distances Mercator keeps, so labels 60px apart on screen read as
 *  colliding — and suppressed each other from half a continent away.
 */
export function labelProjector(zoom: number) {
  const worldPx = 256 * 2 ** zoom
  const pxPerDegX = worldPx / 360
  return {
    pxPerDegX,
    x: (lng: number) => lng * pxPerDegX,
    y: (lat: number) => {
      const s = Math.sin((lat * Math.PI) / 180)
      return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * worldPx
    },
  }
}

/** Cartographic type tiers: the size of the name encodes the size of the
 *  state — great empires speak louder than duchies. */
export function labelTier(area: number): string {
  if (area >= 2000000) return 'empire-label--vast'
  if (area >= 600000) return 'empire-label--large'
  return ''
}

/** Approximate rendered half-width of a polity name in px. Uppercase serif
 *  runs ~0.68em per glyph plus the tier's letter-spacing (kept in sync with
 *  the .empire-label CSS; verified within 2% of the DOM: ROMAN EMPIRE
 *  measured 203.75px vs 208 predicted). The declutter must see real
 *  widths — a fixed 110px box let PRINCIPALITY OF GALICIA-VOLHYNIA and
 *  PRINCIPALITY OF PEREYASLAVL print through each other at 1223. */
export function labelHalfWidth(name: string, area: number): number {
  const tier = labelTier(area)
  const [size, tracking] =
    tier === 'empire-label--vast' ? [17, 0.34] : tier === 'empire-label--large' ? [14, 0.26] : [11, 0.22]
  return (name.length * size * (0.68 + tracking)) / 2
}
