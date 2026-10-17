/**
 * Dot density for the entity atlas by zoom (AtlasLayer). At empire zoom the
 * territory is the point: a sparse sample, famous (knowledge-bearing, t1)
 * sites first; density returns as you zoom in. From zoom 9 nothing is
 * sampled.
 */
interface SampledSite {
  la: number
  lo: number
  t: 1 | 2 | 3
}

/** Grid cell size in degrees per tier at this zoom; null = keep all. */
export function siteSampleGrid(zoom: number): { famous: number | null; rest: number } | null {
  if (zoom <= 5) return { famous: 1.0, rest: 3.0 }
  if (zoom === 6) return { famous: null, rest: 1.0 }
  if (zoom <= 7) return { famous: null, rest: 0.2 }
  if (zoom === 8) return { famous: null, rest: 0.05 }
  return null
}

const cellOf = (s: SampledSite, size: number) =>
  `${Math.floor(s.la / size)},${Math.floor(s.lo / size)}`

function spatialSample<T extends SampledSite>(items: T[], size: number, taken: Set<string>): T[] {
  return items.filter((item) => {
    const key = cellOf(item, size)
    if (taken.has(key)) return false
    taken.add(key)
    return true
  })
}

/** One dot per grid cell, famous sites first: an anonymous neighbor never
 *  takes the cell of a famous site. */
export function sampleSites<T extends SampledSite>(items: T[], zoom: number): T[] {
  const grid = siteSampleGrid(zoom)
  if (!grid) return items
  const famous = items.filter((e) => e.t === 1)
  const keptFamous = grid.famous == null ? famous : spatialSample(famous, grid.famous, new Set())
  const taken = new Set(keptFamous.map((e) => cellOf(e, grid.rest)))
  const rest = spatialSample(
    items.filter((e) => e.t !== 1),
    grid.rest,
    taken,
  )
  return keptFamous.concat(rest)
}
