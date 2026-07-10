import type { Aqueduct } from '@/data/aqueducts'
import type { Battle } from '@/data/battles'

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
  destroyedYear?: number
  endYear?: number
  estimatedTemporal?: boolean
  source: string
  description?: string
  props?: Record<string, unknown>
}

function stripPrefix(id: string): string {
  const i = id.indexOf(':')
  return i >= 0 ? id.slice(i + 1) : id
}

function parseChunk(raw: { default: string }): UnifiedEntity[] {
  return JSON.parse(raw.default) as UnifiedEntity[]
}

export async function loadAqueductPoints(): Promise<Aqueduct[]> {
  return parseChunk(await import('@/data/unified/aqueduct.json?raw')).map((e) => ({
    id: stripPrefix(e.id),
    name: e.name,
    lat: e.lat,
    lng: e.lng,
    constructionYear: e.startYear ?? 0,
    length: (e.props?.length as number) ?? null,
    builder: (e.props?.builder as string) ?? null,
    cityServed: (e.props?.cityServed as string) ?? '',
    destroyedYear: e.destroyedYear,
    description: e.description ?? '',
    source: e.source,
  }))
}

export async function loadBattles(): Promise<Battle[]> {
  return parseChunk(await import('@/data/unified/battle.json?raw')).map((e) => ({
    id: stripPrefix(e.id),
    name: e.name,
    year: e.startYear ?? 0,
    lat: e.lat,
    lng: e.lng,
    outcome: ((e.props?.outcome as string) ?? 'unknown') as Battle['outcome'],
    combatants: (e.props?.combatants as string) ?? '',
    commander: (e.props?.commander as string) ?? '',
    description: e.description ?? '',
    source: e.source,
  }))
}
