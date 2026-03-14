import { z } from 'zod'
import { EntityBaseSchema } from './base'

export const InfrastructureSchema = EntityBaseSchema.extend({
  entityType: z.literal('infrastructure'),
  builtBy: z.string().optional(),
  builtYear: z.number().optional(),
  infraType: z.string().optional(),
})
