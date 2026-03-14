import { z } from 'zod'
import { EntityBaseSchema } from './base'

export const LocationSchema = EntityBaseSchema.extend({
  entityType: z.literal('location'),
  locationType: z.string().optional(),
  coordinates: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
  province: z.string().optional(),
})
