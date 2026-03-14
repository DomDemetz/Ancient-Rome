import { z } from 'zod'

export const StoryStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  entityIds: z.array(z.string()).optional(),
  connectionIds: z.array(z.string()).optional(),
  year: z.number().optional(),
})

export const StorySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  steps: z.array(StoryStepSchema),
  tags: z.array(z.string()).optional(),
})
