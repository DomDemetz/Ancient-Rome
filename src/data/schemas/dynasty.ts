import { z } from 'zod'
import { EntityBaseSchema } from './base'

export const DynastySchema = EntityBaseSchema.extend({
  entityType: z.literal('dynasty'),
  founder: z.string().optional(),
  startYear: z.number().optional(),
  endYear: z.number().optional(),
})
