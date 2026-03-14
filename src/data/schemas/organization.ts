import { z } from 'zod'
import { EntityBaseSchema } from './base'

export const OrganizationSchema = EntityBaseSchema.extend({
  entityType: z.literal('organization'),
  founded: z.number().optional(),
  dissolved: z.number().optional(),
  orgType: z.string().optional(),
})
