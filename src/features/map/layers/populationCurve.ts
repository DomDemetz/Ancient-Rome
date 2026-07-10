import type { PlacePopulationPoint } from '@/data/places'

/**
 * Population at a year, linearly interpolated along the attested curve.
 * Shared by PlacesLayer (render + label gates) and EmpiresLayer (labeled-city
 * dodge obstacles) so both judge "is this city on the map" identically.
 *
 * No extrapolation: outside the attested curve the node falls back to its
 * DARE styling. (Clamping made Baghdad "populated" in 117 AD — the merged
 * node inherits DARE's wide span, but its curve only starts in 763.)
 */
export function popAt(points: PlacePopulationPoint[], year: number): number | null {
  if (points.length === 0) return null
  if (year < points[0].year || year > points[points.length - 1].year) return null
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (year >= a.year && year <= b.year) {
      const span = b.year - a.year
      if (span === 0) return a.population
      const t = (year - a.year) / span
      return Math.round(a.population + t * (b.population - a.population))
    }
  }
  return null
}
