import { describe, it, expect } from 'vitest'
import {
  metersPerPixel,
  niceNumber,
  graticuleStepMinutes,
  formatLatitude,
  formatLongitude,
  gridCellMeters,
  scaleRows,
  formatDistance,
  ROMAN_MILE_M,
  greatCircleMeters,
  greatCirclePath,
  distanceLabels,
} from './measure'

describe('metersPerPixel', () => {
  it('matches the Web Mercator constant at the equator', () => {
    expect(metersPerPixel(0, 0)).toBeCloseTo(156543.03, 1)
    expect(metersPerPixel(0, 5)).toBeCloseTo(4891.97, 1)
  })

  it('shrinks with the cosine of latitude', () => {
    expect(metersPerPixel(60, 5)).toBeCloseTo(metersPerPixel(0, 5) / 2, 3)
  })
})

describe('niceNumber', () => {
  it('rounds down to 1 / 2 / 5 × 10ⁿ', () => {
    expect(niceNumber(730)).toBe(500)
    expect(niceNumber(499)).toBe(200)
    expect(niceNumber(1.9)).toBe(1)
    expect(niceNumber(0.07)).toBeCloseTo(0.05)
    expect(niceNumber(5)).toBe(5)
  })
})

describe('graticuleStepMinutes', () => {
  it('opens on a 5° grid at the default zoom', () => {
    expect(graticuleStepMinutes(5)).toBe(300)
  })

  it('refines as the map zooms in and never drops below 1′', () => {
    expect(graticuleStepMinutes(7)).toBe(60)
    expect(graticuleStepMinutes(10)).toBe(10)
    expect(graticuleStepMinutes(18)).toBe(1)
  })

  it('caps at 30° when zoomed all the way out', () => {
    expect(graticuleStepMinutes(0)).toBe(1800)
  })
})

describe('angle labels', () => {
  it('formats latitude with hemisphere and minutes', () => {
    expect(formatLatitude(2490)).toBe('41°30′N')
    expect(formatLatitude(-300)).toBe('5°S')
    expect(formatLatitude(0)).toBe('0°')
    expect(formatLatitude(5)).toBe('5′N')
  })

  it('folds longitude past the antimeridian', () => {
    expect(formatLongitude(750)).toBe('12°30′E')
    expect(formatLongitude(-600)).toBe('10°W')
    expect(formatLongitude(190 * 60)).toBe('170°W')
    expect(formatLongitude(180 * 60)).toBe('180°')
  })
})

describe('gridCellMeters', () => {
  it('keeps north–south spacing constant and narrows east–west with latitude', () => {
    const rome = gridCellMeters(300, 41.9)
    expect(formatDistance(rome.ns)).toBe('556 km')
    expect(formatDistance(rome.ew)).toBe('414 km')
    expect(gridCellMeters(300, 0).ns).toBe(rome.ns)
  })
})

describe('scaleRows', () => {
  it('gives round km, mile and Roman-mile bars that fit the width', () => {
    const rows = scaleRows(41.9, 5, 120)
    expect(rows.map((r) => r.label)).toEqual(['200 km', '200 mi', '200 Roman mi'])
    for (const r of rows) expect(r.px).toBeLessThanOrEqual(120)
    // bar length is the stated distance at this latitude
    expect(rows[2].px * metersPerPixel(41.9, 5)).toBeCloseTo(200 * ROMAN_MILE_M, 3)
  })

  it('drops to metres, feet and paces at street zoom', () => {
    const rows = scaleRows(41.9, 17, 120)
    expect(rows.map((r) => r.label)).toEqual(['100 m', '200 ft', '50 Roman paces'])
  })
})

describe('great-circle ruler', () => {
  const rome: [number, number] = [41.9, 12.5]
  const alexandria: [number, number] = [31.2, 29.9]

  it('measures Rome to Alexandria', () => {
    // 1,950 km ± a few — the textbook figure
    expect(greatCircleMeters(rome, alexandria) / 1000).toBeGreaterThan(1930)
    expect(greatCircleMeters(rome, alexandria) / 1000).toBeLessThan(1970)
  })

  it('makes one degree of latitude 111 km', () => {
    expect(greatCircleMeters([40, 10], [41, 10]) / 1000).toBeCloseTo(111.2, 1)
  })

  it('draws a path that starts and ends on the two points', () => {
    const path = greatCirclePath(rome, alexandria, 16)
    expect(path).toHaveLength(17)
    expect(path[0][0]).toBeCloseTo(rome[0], 6)
    expect(path[16][1]).toBeCloseTo(alexandria[1], 6)
    // the pieces add up to the whole
    let sum = 0
    for (let i = 1; i < path.length; i++) sum += greatCircleMeters(path[i - 1], path[i])
    expect(sum).toBeCloseTo(greatCircleMeters(rome, alexandria), 0)
  })

  it('bows toward the pole between two points on the same parallel', () => {
    const path = greatCirclePath([45, -5], [45, 35], 2)
    expect(path[1][0]).toBeGreaterThan(45)
  })

  it('survives a zero-length line', () => {
    expect(greatCirclePath(rome, rome)).toEqual([rome, rome])
  })

  it('labels a distance in km, miles and Roman miles', () => {
    expect(distanceLabels(1_480_000)).toEqual({
      km: '1,480 km',
      mi: '920 mi',
      roman: '1,000 Roman mi',
    })
    expect(distanceLabels(148)).toEqual({ km: '148 m', mi: '486 ft', roman: '100 Roman paces' })
  })
})
