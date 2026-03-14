import type { Entity, Connection, GraphNode, GraphLink } from '@/types'
import { entityColors } from '@/lib/colors'

export function entitiesToNodes(entities: Entity[]): GraphNode[] {
  return entities.map((entity) => ({
    id: entity.id,
    name: entity.name,
    entityType: entity.entityType,
    radius: 6,
  }))
}

export function connectionsToLinks(connections: Connection[], nodeIds: Set<string>): GraphLink[] {
  return connections
    .filter((conn) => nodeIds.has(conn.source) && nodeIds.has(conn.target))
    .map((conn) => ({
      id: conn.id,
      source: conn.source,
      target: conn.target,
      connectionType: conn.connectionType,
      strength: conn.strength,
    }))
}

export function getNodeColor(entityType: string): string {
  return entityColors[entityType as Entity['entityType']] ?? '#888'
}
