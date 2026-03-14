import { z } from 'zod'
import { EntityBaseSchema } from './base'

export const ReligionSchema = EntityBaseSchema.extend({
  entityType: z.literal('religion'),
  origin: z.string().optional(),
  deities: z.array(z.string()).optional(),
})
