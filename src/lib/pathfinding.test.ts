import { describe, it, expect } from 'vitest'
import { findShortestPath } from './pathfinding'
import type { Connection } from '@/types'

// Minimal connection factory
function makeConn(
  id: string,
  source: string,
  target: string,
  overrides: Partial<Connection> = {},
): Connection {
  return {
    id,
    source,
    target,
    connectionType: 'alliance',
    strength: 1,
    evidence: 'test',
    sources: [],
    ...overrides,
  }
}

describe('findShortestPath', () => {
  it('returns single-step path when source === target', () => {
    const path = findShortestPath('A', 'A', [])
    expect(path).toEqual([{ entityId: 'A', connection: null }])
  })

  it('returns null when no path exists', () => {
    const connections: Connection[] = [makeConn('c1', 'A', 'B'), makeConn('c2', 'C', 'D')]
    expect(findShortestPath('A', 'D', connections)).toBeNull()
  })

  it('finds direct 1-hop path', () => {
    const c1 = makeConn('c1', 'A', 'B')
    const path = findShortestPath('A', 'B', [c1])
    expect(path).not.toBeNull()
    expect(path!.length).toBe(2)
    expect(path![0].entityId).toBe('A')
    expect(path![1].entityId).toBe('B')
    expect(path![1].connection).toEqual(c1)
  })

  it('traverses in reverse direction (undirected)', () => {
    const c1 = makeConn('c1', 'B', 'A') // target → source reversed
    const path = findShortestPath('A', 'B', [c1])
    expect(path).not.toBeNull()
    expect(path!.length).toBe(2)
  })

  it('finds 2-hop path', () => {
    const connections: Connection[] = [makeConn('c1', 'A', 'B'), makeConn('c2', 'B', 'C')]
    const path = findShortestPath('A', 'C', connections)
    expect(path).not.toBeNull()
    expect(path!.length).toBe(3)
    expect(path!.map((s) => s.entityId)).toEqual(['A', 'B', 'C'])
  })

  it('finds shortest of multiple paths', () => {
    // A-B-C is 2 hops, A-D-E-C is 3 hops — should prefer A-B-C
    const connections: Connection[] = [
      makeConn('c1', 'A', 'B'),
      makeConn('c2', 'B', 'C'),
      makeConn('c3', 'A', 'D'),
      makeConn('c4', 'D', 'E'),
      makeConn('c5', 'E', 'C'),
    ]
    const path = findShortestPath('A', 'C', connections)
    expect(path).not.toBeNull()
    expect(path!.length).toBe(3) // 3 steps: A, B, C
    expect(path!.map((s) => s.entityId)).toEqual(['A', 'B', 'C'])
  })

  it('returns path with correct connection references', () => {
    const c1 = makeConn('c1', 'A', 'B')
    const c2 = makeConn('c2', 'B', 'C')
    const path = findShortestPath('A', 'C', [c1, c2])!
    expect(path[0].connection).toBeNull()
    expect(path[1].connection).toEqual(c1)
    expect(path[2].connection).toEqual(c2)
  })

  it('handles disconnected graph with many nodes', () => {
    // A is connected to B-Z chain, but not to X
    const connections: Connection[] = Array.from({ length: 25 }, (_, i) =>
      makeConn(`c${i}`, String.fromCharCode(65 + i), String.fromCharCode(66 + i)),
    )
    // A→B→...→Z, find A to Z
    const path = findShortestPath('A', 'Z', connections)
    expect(path).not.toBeNull()
    expect(path!.length).toBe(26)
  })
})
