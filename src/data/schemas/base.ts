import { z } from 'zod'

export const EntityTypeSchema = z.enum([
  'person',
  'organization',
  'event',
  'location',
  'document',
  'legion',
  'dynasty',
  'religion',
  'trade-good',
  'infrastructure',
])

export const EntityBaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  sources: z.array(z.string()),
  imageUrl: z.string().optional(),
  tags: z.array(z.string()).optional(),
})
