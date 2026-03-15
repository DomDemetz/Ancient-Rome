import { describe, it, expect } from 'vitest'
import { filterEntities, filterConnections } from './filtering'
import type { Entity, Connection } from '@/types'

// Helper factories
function makePerson(id: string, born?: number, died?: number): Entity {
  return {
    id,
    name: `Person ${id}`,
    description: '',
    sources: [],
    entityType: 'person',
    ...(born !== undefined ? { born } : {}),
    ...(died !== undefined ? { died } : {}),
  }
}

function makeEvent(id: string, date?: number, endDate?: number): Entity {
  return {
    id,
    name: `Event ${id}`,
    description: '',
    sources: [],
    entityType: 'event',
    ...(date !== undefined ? { date } : {}),
    ...(endDate !== undefined ? { endDate } : {}),
  }
}

function makeLocation(id: string, province?: string): Entity {
  return {
    id,
    name: `Location ${id}`,
    description: '',
    sources: [],
    entityType: 'location',
    ...(province !== undefined ? { province } : {}),
  }
}

function makeConnection(
  id: string,
  source: string,
  target: string,
  connectionType: Connection['connectionType'] = 'alliance',
): Connection {
  return {
    id,
    source,
    target,
    connectionType,
    strength: 1,
    evidence: 'test',
    sources: [],
  }
}

const DEFAULT_YEAR_RANGE: [number, number] = [-753, 476]

describe('filterEntities', () => {
  const caesar = makePerson('caesar', -100, -44)
  const augustus = makePerson('augustus', -63, 14)
  const battle = makeEvent('battle', -44, -44)
  const rome = makeLocation('rome', 'Latium')
  const carthage = makeLocation('carthage', 'Africa')

  const all: Entity[] = [caesar, augustus, battle, rome, carthage]

  it('returns all entities when no filters applied', () => {
    const result = filterEntities(all, {
      entityTypes: [],
      regions: [],
      yearRange: DEFAULT_YEAR_RANGE,
    })
    expect(result.length).toBe(all.length)
  })

  it('filters by entityType', () => {
    const result = filterEntities(all, {
      entityTypes: ['person'],
      regions: [],
      yearRange: DEFAULT_YEAR_RANGE,
    })
    expect(result.every((e) => e.entityType === 'person')).toBe(true)
    expect(result.length).toBe(2)
  })

  it('filters by multiple entityTypes', () => {
    const result = filterEntities(all, {
      entityTypes: ['person', 'event'],
      regions: [],
      yearRange: DEFAULT_YEAR_RANGE,
    })
    expect(result.length).toBe(3)
  })

  it('filters by region', () => {
    const result = filterEntities(all, {
      entityTypes: [],
      regions: ['Latium'],
      yearRange: DEFAULT_YEAR_RANGE,
    })
    // Region filter only applies to locations — non-locations (persons, events) pass through
    const locationResults = result.filter((e) => e.entityType === 'location')
    expect(locationResults).toHaveLength(1)
    expect(locationResults[0].id).toBe('rome')
    // Non-locations are not filtered by region
    expect(result.length).toBeGreaterThan(1)
  })

  it('excludes entities outside yearRange', () => {
    // Caesar lived -100 to -44. Searching year range 0 to 100 should exclude him.
    const result = filterEntities([caesar], {
      entityTypes: [],
      regions: [],
      yearRange: [0, 100],
    })
    expect(result).toHaveLength(0)
  })

  it('includes entities overlapping yearRange', () => {
    // Caesar -100 to -44, filter -50 to 50 → overlaps
    const result = filterEntities([caesar], {
      entityTypes: [],
      regions: [],
      yearRange: [-50, 50],
    })
    expect(result).toHaveLength(1)
  })

  it('includes entities with no date info regardless of yearRange', () => {
    const person = makePerson('unknown')
    const result = filterEntities([person], {
      entityTypes: [],
      regions: [],
      yearRange: [0, 100],
    })
    expect(result).toHaveLength(1)
  })

  it('filters by timelineYear', () => {
    // Caesar alive at -50
    const resultAlive = filterEntities(
      [caesar],
      { entityTypes: [], regions: [], yearRange: DEFAULT_YEAR_RANGE },
      -50,
    )
    expect(resultAlive).toHaveLength(1)
    // Caesar dead at 0
    const resultDead = filterEntities(
      [caesar],
      { entityTypes: [], regions: [], yearRange: DEFAULT_YEAR_RANGE },
      0,
    )
    expect(resultDead).toHaveLength(0)
  })

  it('locations without regions are excluded when region filter set', () => {
    const noRegion = makeLocation('nowhere')
    const result = filterEntities([noRegion], {
      entityTypes: [],
      regions: ['Latium'],
      yearRange: DEFAULT_YEAR_RANGE,
    })
    expect(result).toHaveLength(0)
  })
})

describe('filterConnections', () => {
  const personA = makePerson('A')
  const personB = makePerson('B')
  const personC = makePerson('C')
  const connAB = makeConnection('c1', 'A', 'B', 'alliance')
  const connBC = makeConnection('c2', 'B', 'C', 'family')
  const connAC = makeConnection('c3', 'A', 'C', 'rivalry')

  it('returns connections where both endpoints are in filtered set', () => {
    const result = filterConnections([connAB, connBC, connAC], [personA, personB], [])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('c1')
  })

  it('returns all connections when all entities present and no type filter', () => {
    const result = filterConnections([connAB, connBC, connAC], [personA, personB, personC], [])
    expect(result).toHaveLength(3)
  })

  it('filters by connectionType', () => {
    const result = filterConnections(
      [connAB, connBC, connAC],
      [personA, personB, personC],
      ['alliance'],
    )
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('c1')
  })

  it('returns empty when filtered entity set is empty', () => {
    const result = filterConnections([connAB], [], [])
    expect(result).toHaveLength(0)
  })

  it('handles multiple connectionTypes in filter', () => {
    const result = filterConnections(
      [connAB, connBC, connAC],
      [personA, personB, personC],
      ['alliance', 'family'],
    )
    expect(result).toHaveLength(2)
  })
})
