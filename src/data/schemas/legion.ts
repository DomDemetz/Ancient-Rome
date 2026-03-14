import { z } from 'zod'
import { EntityBaseSchema } from './base'

export const LegionSchema = EntityBaseSchema.extend({
  entityType: z.literal('legion'),
  founded: z.number().optional(),
  disbanded: z.number().optional(),
  symbol: z.string().optional(),
  homeBase: z.string().optional(),
})
