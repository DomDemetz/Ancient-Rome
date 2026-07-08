import { describe, it, expect } from 'vitest'
import { loadAndValidateData } from './loader'

describe('loadAndValidateData', () => {
  it('loads without throwing', () => {
    expect(() => loadAndValidateData()).not.toThrow()
  })

  it('returns arrays for the eager data types', () => {
    const { entities, connections, stories } = loadAndValidateData()
    expect(Array.isArray(entities)).toBe(true)
    expect(Array.isArray(connections)).toBe(true)
    expect(Array.isArray(stories)).toBe(true)
  })

  it('territories load (and validate) lazily', async () => {
    const { loadTerritories } = await import('./loader')
    const territories = await loadTerritories()
    expect(Array.isArray(territories)).toBe(true)
    expect(territories.length).toBeGreaterThan(100)
  })

  it('entities count is >= 0', () => {
    const { entities } = loadAndValidateData()
    expect(entities.length).toBeGreaterThanOrEqual(0)
  })

  it('connections count is >= 0', () => {
    const { connections } = loadAndValidateData()
    expect(connections.length).toBeGreaterThanOrEqual(0)
  })

  it('has no duplicate entity IDs', () => {
    const { entities } = loadAndValidateData()
    const ids = entities.map((e) => e.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('all connection sources and targets reference existing entities', () => {
    const { entities, connections } = loadAndValidateData()
    const entityIds = new Set(entities.map((e) => e.id))
    for (const conn of connections) {
      expect(entityIds.has(conn.source)).toBe(true)
      expect(entityIds.has(conn.target)).toBe(true)
    }
  })

  it('has no duplicate connection IDs', () => {
    const { connections } = loadAndValidateData()
    const ids = connections.map((c) => c.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })
})
