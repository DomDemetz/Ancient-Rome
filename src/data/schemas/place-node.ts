import { z } from 'zod'

/** Canonical place node (places.json) — see ENTITY-MODEL.md. */
export const PlaceNodeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  startYear: z.number().int(),
  endYear: z.number().int(),
  pid: z.string().optional(),
  qid: z.string().regex(/^Q\d+$/).optional(),
  modern: z.string().optional(),
  wiki: z.tuple([z.string(), z.string()]).optional(),
  minor: z.boolean().optional(),
  vici: z.array(z.string()).optional(),
  orbis: z
    .object({
      id: z.string(),
      type: z.string(),
    })
    .optional(),
  entity: z.string().optional(),
  entityConnections: z.number().int().optional(),
  near: z.tuple([z.string(), z.number(), z.string()]).optional(),
  dare: z
    .object({
      id: z.string(),
      type: z.number().int().optional(),
      major: z.boolean(),
      territoryYear: z.number().int().optional(),
      declineYear: z.number().int().optional(),
    })
    .optional(),
  populations: z
    .array(z.object({ year: z.number().int(), population: z.number() }))
    .optional(),
})

/** Unified typed point (unified/*.json chunks). */
export const UnifiedEntitySchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  subtype: z.string().nullish(),
  category: z.string().nullish(),
  name: z.string(),
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  qid: z.string().regex(/^Q\d+$/).nullish(),
  startYear: z.number().int().nullish(),
  endYear: z.number().int().nullish(),
  source: z.string(),
  props: z.record(z.string(), z.unknown()).optional(),
  description: z.string().nullish(),
  image: z.string().nullish(),
})
