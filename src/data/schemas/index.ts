import { z } from 'zod'

export * from './base'
export * from './person'
export * from './organization'
export * from './event'
export * from './location'
export * from './document'
export * from './legion'
export * from './dynasty'
export * from './religion'
export * from './trade-good'
export * from './infrastructure'
export * from './connection'
export * from './story'
export * from './territory'

import { PersonSchema } from './person'
import { OrganizationSchema } from './organization'
import { EventSchema } from './event'
import { LocationSchema } from './location'
import { DocumentSchema } from './document'
import { LegionSchema } from './legion'
import { DynastySchema } from './dynasty'
import { ReligionSchema } from './religion'
import { TradeGoodSchema } from './trade-good'
import { InfrastructureSchema } from './infrastructure'

export const EntitySchema = z.discriminatedUnion('entityType', [
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
])
