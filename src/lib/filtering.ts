import type { Entity, Connection, FilterState } from '@/types'

/**
 * Returns a year range for the given entity based on its known date fields.
 * Returns null if no date information is available.
 */
function getEntityYearRange(entity: Entity): [number, number] | null {
  switch (entity.entityType) {
    case 'person':
      if (entity.born !== undefined || entity.died !== undefined) {
        const start = entity.born ?? entity.died!
        const end = entity.died ?? entity.born!
        return [start, end]
      }
      return null
    case 'event':
      if (entity.date !== undefined || entity.endDate !== undefined) {
        const start = entity.date ?? entity.endDate!
        const end = entity.endDate ?? entity.date!
        return [start, end]
      }
      return null
    case 'organization':
      if (entity.founded !== undefined || entity.dissolved !== undefined) {
        const start = entity.founded ?? entity.dissolved!
        const end = entity.dissolved ?? entity.founded!
        return [start, end]
      }
      return null
    case 'legion':
      if (entity.founded !== undefined || entity.disbanded !== undefined) {
        const start = entity.founded ?? entity.disbanded!
        const end = entity.disbanded ?? entity.founded!
        return [start, end]
      }
      return null
    case 'dynasty':
      if (entity.startYear !== undefined || entity.endYear !== undefined) {
        const start = entity.startYear ?? entity.endYear!
        const end = entity.endYear ?? entity.startYear!
        return [start, end]
      }
      return null
    case 'infrastructure':
      if (entity.builtYear !== undefined) {
        return [entity.builtYear, entity.builtYear]
      }
      return null
    case 'location':
      if (entity.founded !== undefined) {
        // Cities persist once founded (no end date)
        return [entity.founded, Infinity]
      }
      return null
    default:
      return null
  }
}

/**
 * Returns the region/province for an entity (used for region filtering).
 */
function getEntityRegion(entity: Entity): string | undefined {
  if (entity.entityType === 'location') {
    return entity.province
  }
  return undefined
}

/**
 * Filters entities by entityTypes, regions, yearRange, and an optional
 * timelineYear (if provided, entity must be active at that year).
 */
export function filterEntities(
  entities: Entity[],
  filters: Pick<FilterState, 'entityTypes' | 'regions' | 'yearRange'>,
  timelineYear?: number,
): Entity[] {
  return entities.filter((entity) => {
    // Filter by entity type
    if (filters.entityTypes.length > 0 && !filters.entityTypes.includes(entity.entityType)) {
      return false
    }

    // Filter by region (only applies to locations — non-locations always pass)
    if (filters.regions.length > 0 && entity.entityType === 'location') {
      const region = getEntityRegion(entity)
      if (!region || !filters.regions.includes(region)) {
        return false
      }
    }

    // Filter by year range
    const [filterStart, filterEnd] = filters.yearRange
    const entityRange = getEntityYearRange(entity)
    if (entityRange !== null) {
      const [entityStart, entityEnd] = entityRange
      // Entity must overlap with the filter's year range
      if (entityEnd < filterStart || entityStart > filterEnd) {
        return false
      }
    }

    // Filter by timeline year (point-in-time visibility)
    if (timelineYear !== undefined) {
      const entityRange = getEntityYearRange(entity)
      if (entityRange !== null) {
        const [entityStart, entityEnd] = entityRange
        if (timelineYear < entityStart || timelineYear > entityEnd) {
          return false
        }
      }
    }

    return true
  })
}

/**
 * Filters connections so that:
 * 1. Both source and target are in the filtered entity set.
 * 2. Connection type matches the filter (if any types are selected).
 */
export function filterConnections(
  connections: Connection[],
  filteredEntities: Entity[],
  connectionTypes: FilterState['connectionTypes'],
): Connection[] {
  const entityIds = new Set(filteredEntities.map((e) => e.id))

  return connections.filter((conn) => {
    // Both endpoints must be in filtered entity set
    if (!entityIds.has(conn.source) || !entityIds.has(conn.target)) {
      return false
    }

    // Filter by connection type
    if (connectionTypes.length > 0 && !connectionTypes.includes(conn.connectionType)) {
      return false
    }

    return true
  })
}
