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
