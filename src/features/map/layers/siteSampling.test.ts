import { describe, it, expect } from 'vitest'
import { sampleSites, siteSampleGrid } from './siteSampling'

type Site = { la: number; lo: number; t: 1 | 2 | 3; id: string }
const site = (id: string, la: number, lo: number, t: 1 | 2 | 3 = 2): Site => ({ id, la, lo, t })

describe('siteSampleGrid', () => {
  it('thins hardest at empire zoom and stops sampling from zoom 9', () => {
    expect(siteSampleGrid(5)).toEqual({ famous: 1.0, rest: 3.0 })
    expect(siteSampleGrid(4)).toEqual(siteSampleGrid(5))
    expect(siteSampleGrid(6)?.rest).toBe(1.0)
    expect(siteSampleGrid(9)).toBeNull()
  })
})

describe('sampleSites', () => {
  it('keeps one anonymous dot per 3-degree cell at zoom 5', () => {
    const out = sampleSites([site('a', 40.1, 10.1), site('b', 41.5, 11.5), site('c', 44, 10)], 5)
    expect(out.map((s) => s.id)).toEqual(['a', 'c'])
  })

  it('an anonymous site never takes the cell of a famous one', () => {
    const out = sampleSites([site('anon', 40.1, 10.1), site('famous', 41.5, 11.5, 1)], 5)
    expect(out.map((s) => s.id)).toEqual(['famous'])
  })

  it('thins famous sites to one per degree at zoom 5, keeps them all at 6', () => {
    const famous = [site('f1', 40.1, 10.1, 1), site('f2', 40.6, 10.6, 1)]
    expect(sampleSites(famous, 5).map((s) => s.id)).toEqual(['f1'])
    expect(sampleSites(famous, 6).map((s) => s.id)).toEqual(['f1', 'f2'])
  })

  it('returns everything from zoom 9', () => {
    const all = [site('a', 40.1, 10.1), site('b', 40.1001, 10.1001)]
    expect(sampleSites(all, 9)).toBe(all)
  })
})
