import { z } from 'zod'
import { EntityBaseSchema } from './base'

export const EventSchema = EntityBaseSchema.extend({
  entityType: z.literal('event'),
  date: z.number().optional(),
  endDate: z.number().optional(),
  eventType: z.string().optional(),
})
