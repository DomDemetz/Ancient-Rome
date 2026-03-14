import { z } from 'zod'

export const TerritoryStatusSchema = z.enum(['controlled', 'contested', 'lost', 'allied'])

export const TerritorySnapshotSchema = z.object({
  id: z.string(),
  year: z.number(),
  controlledBy: z.string(),
  status: TerritoryStatusSchema,
  boundaries: z.any(), // GeoJSON validated at load time
  label: z.string().optional(),
})
