import { describe, it, expect } from 'vitest'
import { PersonSchema, ConnectionSchema, EntitySchema } from '.'

describe('PersonSchema', () => {
  it('accepts valid person', () => {
    const result = PersonSchema.safeParse({
      id: 'julius-caesar',
      name: 'Julius Caesar',
      entityType: 'person',
      description: 'Roman dictator',
      born: -100,
      died: -44,
      roles: ['dictator', 'general'],
      faction: 'Populares',
      sources: ['https://en.wikipedia.org/wiki/Julius_Caesar'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects person missing required name', () => {
    const result = PersonSchema.safeParse({
      id: 'test',
      entityType: 'person',
      description: 'test',
      sources: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects person with wrong entityType', () => {
    const result = PersonSchema.safeParse({
      id: 'test',
      name: 'Test',
      entityType: 'location',
      description: 'test',
      sources: [],
    })
    expect(result.success).toBe(false)
  })
})

describe('ConnectionSchema', () => {
  it('accepts valid connection', () => {
    const result = ConnectionSchema.safeParse({
      id: 'conn-1',
      source: 'julius-caesar',
      target: 'roman-senate',
      connectionType: 'opposition',
      strength: 3,
      evidence: 'Caesar crossed the Rubicon',
      sources: ['https://en.wikipedia.org/wiki/Crossing_the_Rubicon'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid connection type', () => {
    const result = ConnectionSchema.safeParse({
      id: 'c1',
      source: 'a',
      target: 'b',
      connectionType: 'invalid_type',
      strength: 1,
      evidence: 'test',
      sources: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects strength outside 1-3', () => {
    const result = ConnectionSchema.safeParse({
      id: 'c1',
      source: 'a',
      target: 'b',
      connectionType: 'alliance',
      strength: 5,
      evidence: 'test',
      sources: [],
    })
    expect(result.success).toBe(false)
  })
})

describe('EntitySchema', () => {
  it('discriminates by entityType', () => {
    expect(
      EntitySchema.safeParse({
        id: 'test',
        name: 'Test',
        entityType: 'person',
        description: 'test',
        sources: [],
      }).success,
    ).toBe(true)

    expect(
      EntitySchema.safeParse({
        id: 'test',
        name: 'Test',
        entityType: 'location',
        description: 'test',
        locationType: 'city',
        coordinates: { lat: 41.9, lng: 12.5 },
        sources: [],
      }).success,
    ).toBe(true)
  })
})
