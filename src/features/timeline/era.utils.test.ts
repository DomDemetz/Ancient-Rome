import { describe, it, expect } from 'vitest'
import { detectEras } from './era.utils'

describe('detectEras', () => {
  it('returns empty array for empty input', () => {
    expect(detectEras([])).toEqual([])
  })

  it('returns at least one era for clustered years', () => {
    // Dense cluster around 0 AD
    const years = [-10, -5, 0, 5, 10, 15, 20]
    const eras = detectEras(years)
    expect(eras.length).toBeGreaterThanOrEqual(1)
    const era = eras[0]
    expect(era).toHaveProperty('startYear')
    expect(era).toHaveProperty('endYear')
    expect(era).toHaveProperty('density')
    expect(era.density).toBeGreaterThan(0)
    expect(era.endYear).toBeGreaterThanOrEqual(era.startYear)
  })

  it('returns era spanning clustered range', () => {
    // All years in same 25-year bucket: -50 to -26
    const years = [-50, -45, -40, -35, -30]
    const eras = detectEras(years)
    expect(eras.length).toBeGreaterThanOrEqual(1)
    expect(eras[0].density).toBe(1)
  })

  it('splits into multiple eras for distinct clusters', () => {
    // Cluster 1: -100 to -75 (Roman Republic)
    // Cluster 2: 100 to 125 (Roman Empire)
    const cluster1 = [-100, -95, -90, -85, -80, -75]
    const cluster2 = [100, 105, 110, 115, 120, 125]
    const eras = detectEras([...cluster1, ...cluster2])
    // Should detect at least 2 separate eras
    expect(eras.length).toBeGreaterThanOrEqual(2)
  })

  it('respects custom threshold — higher threshold yields fewer eras', () => {
    const years = [-100, -95, -90, -50, 50, 55]
    const lowThresholdEras = detectEras(years, 0.1)
    const highThresholdEras = detectEras(years, 0.9)
    expect(highThresholdEras.length).toBeLessThanOrEqual(lowThresholdEras.length)
  })

  it('handles a single year', () => {
    const eras = detectEras([-44])
    expect(eras.length).toBe(1)
    expect(eras[0].density).toBe(1)
  })

  it('era startYear is always <= endYear', () => {
    const years = [-753, -500, -300, -100, 0, 100, 300, 476]
    const eras = detectEras(years)
    for (const era of eras) {
      expect(era.startYear).toBeLessThanOrEqual(era.endYear)
    }
  })
})
