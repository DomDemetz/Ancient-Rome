interface TemporalRoadProps {
  startYear?: number
  endYear?: number
  attestedYear?: number | null
  isNamed?: boolean
  territoryYear?: number | null
  declineYear?: number | null
}

/**
 * Determines whether a road segment should be visible at the given year.
 */
export function shouldShowRoad(props: TemporalRoadProps, currentYear: number): boolean {
  // Named DARE roads: use attested year, no territory logic
  if (props.attestedYear != null) {
    return currentYear >= props.attestedYear
  }

  // Already-dated Itiner-e segments: use original startYear/endYear
  if (props.startYear != null && props.startYear !== 0) {
    if (props.startYear > currentYear) return false
    if (props.endYear != null && props.endYear !== 0 && props.endYear < currentYear) return false
    return true
  }

  // Territory-correlated: visibility year = territoryYear + 20
  if (props.territoryYear != null) {
    const visYear = props.territoryYear + 20
    if (currentYear < visYear) return false

    // Decline: hidden after 50 years past decline start
    if (props.declineYear != null && currentYear > props.declineYear + 50) return false

    return true
  }

  // No temporal data at all (e.g. undated Itiner-e segments): always visible,
  // but respect decline if present
  if (props.declineYear != null && currentYear > props.declineYear + 50) return false
  return true
}

/**
 * Computes the opacity for a road segment at the given year.
 * Handles fade-in (30-year ramp) and decline (50-year decay).
 * Named roads have no fade-in (instant appearance).
 */
export function getRoadOpacity(
  props: TemporalRoadProps,
  currentYear: number,
  baseOpacity: number,
): number {
  // Named roads: instant appearance, no fade-in
  if (props.isNamed && props.attestedYear != null) {
    let opacity = baseOpacity
    if (props.declineYear != null && currentYear > props.declineYear) {
      const decay = Math.min(1, (currentYear - props.declineYear) / 50)
      opacity *= 1 - decay
    }
    return opacity
  }

  // Compute visibility year; roads with no temporal data at all are always
  // visible (shouldShowRoad lets them through), so they get no fade-in
  let opacity: number
  if (props.startYear != null && props.startYear !== 0) {
    const fadeIn = Math.min(1, Math.max(0, (currentYear - props.startYear) / 30))
    opacity = baseOpacity * fadeIn
  } else if (props.territoryYear != null) {
    const visYear = props.territoryYear + 20
    const fadeIn = Math.min(1, Math.max(0, (currentYear - visYear) / 30))
    opacity = baseOpacity * fadeIn
  } else {
    opacity = baseOpacity
  }

  // Decline over 50 years
  if (props.declineYear != null && currentYear > props.declineYear) {
    const decay = Math.min(1, (currentYear - props.declineYear) / 50)
    opacity *= 1 - decay
  }

  return opacity
}

/**
 * Returns a dashArray string for decline styling, or undefined for normal.
 */
export function getDeclineDash(
  declineYear: number | null | undefined,
  currentYear: number,
  hypothetical: boolean,
): string | undefined {
  if (declineYear != null && currentYear > declineYear) {
    return currentYear > declineYear + 25 ? '4 6' : '6 4'
  }
  return hypothetical ? '4 3' : undefined
}
