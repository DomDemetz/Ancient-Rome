import { describe, it, expect } from 'vitest'
import { shouldShowRoad, getRoadOpacity, getDeclineDash } from './road-style'

describe('shouldShowRoad', () => {
  it('hides named DARE road before attested year', () => {
    expect(shouldShowRoad({ attestedYear: -312, isNamed: true }, -400)).toBe(false)
  })

  it('shows named DARE road at attested year', () => {
    expect(shouldShowRoad({ attestedYear: -312, isNamed: true }, -312)).toBe(true)
  })

  it('hides territory-correlated road before visibility year (territoryYear + 20)', () => {
    expect(shouldShowRoad({ territoryYear: -264 }, -260)).toBe(false)
  })

  it('shows territory-correlated road at visibility year', () => {
    expect(shouldShowRoad({ territoryYear: -264 }, -244)).toBe(true)
  })

  it('hides road 50+ years after decline', () => {
    expect(shouldShowRoad({ territoryYear: -264, declineYear: 400 }, 451)).toBe(false)
  })

  it('shows road within 50-year decline window', () => {
    expect(shouldShowRoad({ territoryYear: -264, declineYear: 400 }, 430)).toBe(true)
  })

  it('preserves existing non-zero startYear', () => {
    expect(shouldShowRoad({ startYear: -514, endYear: 0 }, -520)).toBe(false)
    expect(shouldShowRoad({ startYear: -514, endYear: 0 }, -514)).toBe(true)
  })

  it('respects existing endYear', () => {
    expect(shouldShowRoad({ startYear: -200, endYear: -49 }, -50)).toBe(true)
    expect(shouldShowRoad({ startYear: -200, endYear: -49 }, -48)).toBe(false)
  })

  it('shows road with no temporal data from the dawn of Roman road-building', () => {
    expect(shouldShowRoad({ territoryYear: null }, 100)).toBe(true)
    expect(shouldShowRoad({ territoryYear: null }, -312)).toBe(true)
  })

  it('hides road with no temporal data before Roman roads existed', () => {
    expect(shouldShowRoad({ territoryYear: null }, -700)).toBe(false)
  })

  it('still respects decline on roads with no territory correlation', () => {
    expect(shouldShowRoad({ territoryYear: null, declineYear: 400 }, 430)).toBe(true)
    expect(shouldShowRoad({ territoryYear: null, declineYear: 400 }, 451)).toBe(false)
  })
})

describe('getRoadOpacity', () => {
  it('returns full opacity for named roads (no fade-in)', () => {
    expect(getRoadOpacity({ attestedYear: -312, isNamed: true }, -312, 0.9)).toBe(0.9)
  })

  it('returns 0 opacity at start of fade-in window', () => {
    expect(getRoadOpacity({ territoryYear: -264 }, -244, 0.5)).toBeCloseTo(0, 2)
  })

  it('returns half opacity midway through fade-in', () => {
    expect(getRoadOpacity({ territoryYear: -264 }, -229, 0.5)).toBeCloseTo(0.25, 2)
  })

  it('returns full opacity after fade-in complete', () => {
    expect(getRoadOpacity({ territoryYear: -264 }, -200, 0.5)).toBe(0.5)
  })

  it('gives full opacity to roads with no temporal data (no fade-in)', () => {
    expect(getRoadOpacity({ territoryYear: null }, -500, 0.5)).toBe(0.5)
    expect(getRoadOpacity({ territoryYear: null }, 100, 0.5)).toBe(0.5)
  })

  it('reduces opacity during decline', () => {
    const opacity = getRoadOpacity({ territoryYear: -264, declineYear: 400 }, 425, 0.5)
    expect(opacity).toBeLessThan(0.5)
    expect(opacity).toBeGreaterThan(0)
  })

  it('returns 0 opacity at end of decline window', () => {
    expect(getRoadOpacity({ territoryYear: -264, declineYear: 400 }, 450, 0.5)).toBeCloseTo(0, 2)
  })
})

describe('getDeclineDash', () => {
  it('returns undefined for normal road', () => {
    expect(getDeclineDash(null, 100, false)).toBeUndefined()
  })

  it('returns hypothetical dash for hypothetical road', () => {
    expect(getDeclineDash(null, 100, true)).toBe('4 3')
  })

  it('returns early decline dash', () => {
    expect(getDeclineDash(400, 410, false)).toBe('6 4')
  })

  it('returns late decline dash', () => {
    expect(getDeclineDash(400, 430, false)).toBe('4 6')
  })

  it('decline dash overrides hypothetical', () => {
    expect(getDeclineDash(400, 410, true)).toBe('6 4')
  })
})
