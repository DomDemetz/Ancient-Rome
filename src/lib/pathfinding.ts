import type { Connection } from '@/types'

export interface PathStep {
  entityId: string
  connection: Connection | null // null for the start node
}

/**
 * BFS shortest path between two entities using the connection graph.
 * Returns null if no path exists.
 */
export function findShortestPath(
  sourceId: string,
  targetId: string,
  connections: Connection[],
): PathStep[] | null {
  if (sourceId === targetId) {
    return [{ entityId: sourceId, connection: null }]
  }

  // Build adjacency list (undirected — connections go both ways)
  const adjacency = new Map<string, { neighborId: string; connection: Connection }[]>()

  for (const conn of connections) {
    if (!adjacency.has(conn.source)) adjacency.set(conn.source, [])
    if (!adjacency.has(conn.target)) adjacency.set(conn.target, [])
    adjacency.get(conn.source)!.push({ neighborId: conn.target, connection: conn })
    adjacency.get(conn.target)!.push({ neighborId: conn.source, connection: conn })
  }

  // BFS
  const visited = new Set<string>([sourceId])
  const queue: Array<{ entityId: string; path: PathStep[] }> = [
    { entityId: sourceId, path: [{ entityId: sourceId, connection: null }] },
  ]

  while (queue.length > 0) {
    const { entityId, path } = queue.shift()!
    const neighbors = adjacency.get(entityId) ?? []

    for (const { neighborId, connection } of neighbors) {
      if (visited.has(neighborId)) continue
      visited.add(neighborId)

      const newPath: PathStep[] = [...path, { entityId: neighborId, connection }]

      if (neighborId === targetId) {
        return newPath
      }

      queue.push({ entityId: neighborId, path: newPath })
    }
  }

  return null
}
