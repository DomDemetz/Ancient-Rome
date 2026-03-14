import type * as d3 from 'd3'
import type { z } from 'zod'
import type {
  PersonSchema,
  OrganizationSchema,
  EventSchema,
  LocationSchema,
  DocumentSchema,
  LegionSchema,
  DynastySchema,
  ReligionSchema,
  TradeGoodSchema,
  InfrastructureSchema,
  EntitySchema,
  ConnectionTypeSchema,
  ConnectionSchema,
  StorySchema,
  StoryStepSchema,
  TerritorySnapshotSchema,
} from '@/data/schemas'

// Entity types (inferred from Zod schemas)
export type Person = z.infer<typeof PersonSchema>
export type Organization = z.infer<typeof OrganizationSchema>
export type Event = z.infer<typeof EventSchema>
export type Location = z.infer<typeof LocationSchema>
export type Document = z.infer<typeof DocumentSchema>
export type Legion = z.infer<typeof LegionSchema>
export type Dynasty = z.infer<typeof DynastySchema>
export type Religion = z.infer<typeof ReligionSchema>
export type TradeGood = z.infer<typeof TradeGoodSchema>
export type Infrastructure = z.infer<typeof InfrastructureSchema>

// Union of all entity types
export type Entity = z.infer<typeof EntitySchema>

// Connection types
export type ConnectionType = z.infer<typeof ConnectionTypeSchema>
export type Connection = z.infer<typeof ConnectionSchema>

// Story types
export type StoryStep = z.infer<typeof StoryStepSchema>
export type Story = z.infer<typeof StorySchema>

// Territory types
export type TerritorySnapshot = z.infer<typeof TerritorySnapshotSchema>

// D3 graph types
export interface GraphNode extends d3.SimulationNodeDatum {
  id: string
  name: string
  entityType: Entity['entityType']
  radius: number
}

export interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  id: string
  connectionType: ConnectionType
  strength: number
}

// Filter state
export interface FilterState {
  entityTypes: Entity['entityType'][]
  connectionTypes: ConnectionType[]
  regions: string[]
  yearRange: [number, number]
  searchQuery: string
}
