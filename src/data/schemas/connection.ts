import { z } from 'zod'

export const ConnectionTypeSchema = z.enum([
  // Political
  'alliance',
  'opposition',
  'faction',
  'succession',
  'assassination',
  'appointment',
  // Military
  'commanded',
  'served_in',
  'battle_participation',
  'campaign',
  'defeated',
  // Social
  'family',
  'mentorship',
  'patronage',
  'rivalry',
  'marriage',
  // Geographic
  'located_in',
  'governed',
  'trade_route',
  'military_route',
  // Cultural
  'authored',
  'dedicated_to',
  'worship',
  'built',
  'founded',
])

export const ConnectionSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  connectionType: ConnectionTypeSchema,
  strength: z.int().min(1).max(3),
  evidence: z.string(),
  sources: z.array(z.string()),
  label: z.string().optional(),
  startDate: z.number().optional(),
  endDate: z.number().optional(),
})
