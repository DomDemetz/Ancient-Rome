import { z } from 'zod'
import { EntityBaseSchema } from './base'

export const DocumentSchema = EntityBaseSchema.extend({
  entityType: z.literal('document'),
  date: z.number().optional(),
  author: z.string().optional(),
  docType: z.string().optional(),
})
