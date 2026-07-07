import { describe, expect, it } from 'vitest'
import { baseTooltipHtml } from './placeTooltip'
import type { PlaceNode } from '@/data/places'

describe('baseTooltipHtml', () => {
  it('renders the geographic-context line for nodes with `near`', () => {
    const node: PlaceNode = {
      id: 'pl-413036',
      name: 'Asculum',
      lat: 42.85,
      lng: 13.57,
      startYear: -268,
      endYear: 476,
      near: ['Rome', 139, 'NE'],
      dare: { id: '413036', type: 11, major: false },
    }
    const html = baseTooltipHtml(node, 'Asculum', null, 117)
    expect(html).toContain('139 km NE of Rome')
  })

  it('omits the line when `near` is absent (majors)', () => {
    const node: PlaceNode = {
      id: 'pl-423025',
      name: 'Rome',
      lat: 41.89,
      lng: 12.48,
      startYear: -750,
      endYear: 1453,
    }
    expect(baseTooltipHtml(node, 'Rome', 430000, 117)).not.toContain(' of Rome')
  })

  it('names the trade role for ORBIS-joined nodes', () => {
    const node: PlaceNode = {
      id: 'pl-383613',
      name: 'Placentia',
      lat: 45.05,
      lng: 9.7,
      startYear: -218,
      endYear: 1453,
      orbis: { id: 'placentia', type: 'city' },
    }
    expect(baseTooltipHtml(node, 'Placentia', null, 117)).toContain('Trade hub')
  })

  it('falls back to a generic label for unknown ORBIS types', () => {
    const node: PlaceNode = {
      id: 'pl-x',
      name: 'X',
      lat: 0,
      lng: 0,
      startYear: 0,
      endYear: 0,
      orbis: { id: 'x', type: 'weird_future_type' },
    }
    expect(baseTooltipHtml(node, 'X', null, 117)).toContain('Trade site')
  })
})
