import { EntitySchema, ConnectionSchema, StorySchema, TerritorySnapshotSchema } from './schemas'
import type { Entity, Connection, Story, TerritorySnapshot } from '@/types'

import peopleJson from './entities/people.json'
import eventsJson from './entities/events.json'
import locationsJson from './entities/locations.json'
import organizationsJson from './entities/organizations.json'
import documentsJson from './entities/documents.json'
import legionsJson from './entities/legions.json'
import dynastiesJson from './entities/dynasties.json'
import religionsJson from './entities/religions.json'
import tradeGoodsJson from './entities/trade-goods.json'
import infrastructureJson from './entities/infrastructure.json'
import connectionsJson from './entities/connections.json'
import storiesJson from './stories/stories.json'
import territoriesJson from './territories/territories.json'

function validateArray<T>(
  data: unknown[],
  schema: { parse: (d: unknown) => T },
  label: string,
): T[] {
  return data.map((item, i) => {
    try {
      return schema.parse(item)
    } catch (e) {
      throw new Error(`Validation failed for ${label}[${i}]: ${e}`)
    }
  })
}

export function loadAndValidateData() {
  const entities: Entity[] = [
    ...validateArray(peopleJson, EntitySchema, 'people'),
    ...validateArray(eventsJson, EntitySchema, 'events'),
    ...validateArray(locationsJson, EntitySchema, 'locations'),
    ...validateArray(organizationsJson, EntitySchema, 'organizations'),
    ...validateArray(documentsJson, EntitySchema, 'documents'),
    ...validateArray(legionsJson, EntitySchema, 'legions'),
    ...validateArray(dynastiesJson, EntitySchema, 'dynasties'),
    ...validateArray(religionsJson, EntitySchema, 'religions'),
    ...validateArray(tradeGoodsJson, EntitySchema, 'trade-goods'),
    ...validateArray(infrastructureJson, EntitySchema, 'infrastructure'),
  ]
  const connections: Connection[] = validateArray(connectionsJson, ConnectionSchema, 'connections')
  const stories: Story[] = validateArray(storiesJson, StorySchema, 'stories')
  const territories: TerritorySnapshot[] = validateArray(
    territoriesJson,
    TerritorySnapshotSchema,
    'territories',
  )

  // Referential integrity checks
  const entityIds = new Set(entities.map((e) => e.id))
  for (const conn of connections) {
    if (!entityIds.has(conn.source))
      console.warn(`Connection ${conn.id}: source "${conn.source}" not found`)
    if (!entityIds.has(conn.target))
      console.warn(`Connection ${conn.id}: target "${conn.target}" not found`)
  }
  for (const story of stories) {
    for (const step of story.steps) {
      for (const eid of step.entityIds ?? []) {
        if (!entityIds.has(eid))
          console.warn(`Story "${story.id}" step "${step.id}": entityId "${eid}" not found`)
      }
    }
  }

  return { entities, connections, stories, territories }
}
