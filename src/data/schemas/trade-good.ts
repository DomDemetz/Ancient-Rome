import { z } from 'zod'
import { EntityBaseSchema } from './base'

export const TradeGoodSchema = EntityBaseSchema.extend({
  entityType: z.literal('trade-good'),
  origins: z.array(z.string()).optional(),
  destinations: z.array(z.string()).optional(),
})
