import { describe, expect, it } from 'vitest'
import { labelHalfWidth, labelProjector, labelTier } from './labelCollision'

describe('labelProjector', () => {
  it('is true screen space: y distances match Mercator, not linear latitude', () => {
    const { y } = labelProjector(5)
    // At Baltic latitudes linear-lat compressed vertical gaps ~1.6x —
    // two anchors 1° apart at 55°N must be ~1/cos(55°) further apart
    // in y than two anchors 1° apart at the equator.
    const equatorGap = Math.abs(y(0.5) - y(-0.5))
    const balticGap = Math.abs(y(55.5) - y(54.5))
    expect(balticGap / equatorGap).toBeGreaterThan(1.5)
    expect(balticGap / equatorGap).toBeLessThan(1.9)
  })

  it('x is linear in longitude (no cos-latitude shrink)', () => {
    const { x, pxPerDegX } = labelProjector(4)
    expect(x(30) - x(20)).toBeCloseTo(10 * pxPerDegX)
  })
})

describe('labelHalfWidth', () => {
  it('matches the measured DOM width of a vast-tier name within 5%', () => {
    // ROMAN EMPIRE at vast tier measured 203.75px in the browser
    const measured = 203.75 / 2
    const predicted = labelHalfWidth('ROMAN EMPIRE', 3_000_000)
    expect(Math.abs(predicted - measured) / measured).toBeLessThan(0.05)
  })

  it('long principality names are far wider than the old fixed 110px box', () => {
    // The 1223 bug: two of these printed through each other because the
    // declutter assumed every label fit in ±110px.
    expect(labelHalfWidth('PRINCIPALITY OF GALICIA-VOLHYNIA', 100_000)).toBeGreaterThan(140)
  })

  it('collision test: the 1223 pair overlaps at z5 anchor distance, so one must yield', () => {
    const { x, y } = labelProjector(5)
    // label anchors of the two principalities (approx from data)
    const a = { name: 'PRINCIPALITY OF GALICIA-VOLHYNIA', lat: 49.5, lng: 25.0 }
    const b = { name: 'PRINCIPALITY OF PEREYASLAVL', lat: 49.6, lng: 32.0 }
    const dx = Math.abs(x(a.lng) - x(b.lng))
    const dy = Math.abs(y(a.lat) - y(b.lat))
    const sumHalf = labelHalfWidth(a.name, 100_000) + labelHalfWidth(b.name, 100_000)
    expect(dy).toBeLessThan(26) // same row on screen
    expect(dx).toBeLessThan(sumHalf) // widths overlap → collision → suppress
  })

  it('tiers step at the documented area thresholds', () => {
    expect(labelTier(2_000_000)).toBe('empire-label--vast')
    expect(labelTier(600_000)).toBe('empire-label--large')
    expect(labelTier(599_999)).toBe('')
  })
})
