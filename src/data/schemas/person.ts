import { z } from 'zod'
import { EntityBaseSchema } from './base'

export const PersonSchema = EntityBaseSchema.extend({
  entityType: z.literal('person'),
  born: z.number().optional(),
  died: z.number().optional(),
  roles: z.array(z.string()).optional(),
  faction: z.string().optional(),
})
