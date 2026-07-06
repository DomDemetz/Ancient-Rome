export interface UnifiedEntity {
  id: string
  type: string
  subtype?: string
  category?: string
  name: string
  lat: number
  lng: number
  qid?: string
  startYear?: number
  endYear?: number
  source: string
  props?: Record<string, unknown>
}

let cached: UnifiedEntity[] | null = null

export async function loadUnifiedEntities(): Promise<UnifiedEntity[]> {
  if (cached) return cached
  const raw = await import('@/data/unified-entities.json?raw')
  cached = JSON.parse(raw.default) as UnifiedEntity[]
  return cached
}
