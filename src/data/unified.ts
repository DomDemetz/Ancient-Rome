import type { Shipwreck } from '@/data/shipwrecks'
import type { Mine } from '@/data/mines'
import type { Aqueduct } from '@/data/aqueducts'
import type { Press } from '@/data/presses'
import type { Battle } from '@/data/battles'
import type { Amphitheater } from '@/data/amphitheaters'
import type { Building } from '@/data/buildings'
import type { ReligiousSite } from '@/data/religion'

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

function stripPrefix(id: string): string {
  const i = id.indexOf(':')
  return i >= 0 ? id.slice(i + 1) : id
}

export function unifiedToShipwrecks(entities: UnifiedEntity[]): Shipwreck[] {
  return entities
    .filter((e) => e.type === 'shipwreck')
    .map((e) => ({
      id: stripPrefix(e.id),
      name: e.name,
      lat: e.lat,
      lng: e.lng,
      startYear: e.startYear ?? 0,
      endYear: e.endYear ?? 0,
      cargoType: (e.subtype as string) ?? null,
      depth: (e.props?.depth as number) ?? null,
      description: (e.props?.description as string) ?? '',
      source: e.source,
    }))
}

export function unifiedToMines(entities: UnifiedEntity[]): Mine[] {
  return entities
    .filter((e) => e.type === 'mine')
    .map((e) => ({
      id: stripPrefix(e.id),
      name: e.name,
      lat: e.lat,
      lng: e.lng,
      resourceType: e.subtype ?? 'unknown',
      siteType: ((e.props?.siteType as string) ?? 'mine') as 'mine' | 'quarry',
      startYear: e.startYear ?? 0,
      endYear: e.endYear ?? 0,
      description: (e.props?.description as string) ?? '',
      source: e.source,
    }))
}

export function unifiedToAqueducts(entities: UnifiedEntity[]): Aqueduct[] {
  return entities
    .filter((e) => e.type === 'aqueduct')
    .map((e) => ({
      id: stripPrefix(e.id),
      name: e.name,
      lat: e.lat,
      lng: e.lng,
      constructionYear: e.startYear ?? 0,
      length: (e.props?.length as number) ?? null,
      builder: (e.props?.builder as string) ?? null,
      cityServed: (e.props?.cityServed as string) ?? '',
      description: (e.props?.description as string) ?? '',
      source: e.source,
    }))
}

export function unifiedToPresses(entities: UnifiedEntity[]): Press[] {
  return entities
    .filter((e) => e.type === 'press')
    .map((e) => ({
      id: stripPrefix(e.id),
      name: e.name,
      lat: e.lat,
      lng: e.lng,
      pressType: ((e.subtype as string) ?? 'oil') as 'oil' | 'wine',
      startYear: e.startYear ?? 0,
      endYear: e.endYear ?? 0,
      description: (e.props?.description as string) ?? '',
      source: e.source,
    }))
}

export interface PortData {
  id: string
  name: string
  lat: number
  lng: number
  portType: string
  description: string
  startYear: number
  endYear: number
  source: string
}

export function unifiedToPorts(entities: UnifiedEntity[]): PortData[] {
  return entities
    .filter((e) => e.type === 'port')
    .map((e) => ({
      id: stripPrefix(e.id),
      name: e.name,
      lat: e.lat,
      lng: e.lng,
      portType: e.subtype ?? 'port',
      description: (e.props?.description as string) ?? '',
      startYear: e.startYear ?? 0,
      endYear: e.endYear ?? 0,
      source: e.source,
    }))
}

export function unifiedToBattles(entities: UnifiedEntity[]): Battle[] {
  return entities
    .filter((e) => e.type === 'battle')
    .map((e) => ({
      id: stripPrefix(e.id),
      name: e.name,
      year: e.startYear ?? 0,
      lat: e.lat,
      lng: e.lng,
      outcome: ((e.props?.outcome as string) ?? 'unknown') as Battle['outcome'],
      combatants: (e.props?.combatants as string) ?? '',
      commander: (e.props?.commander as string) ?? '',
      description: (e.props?.description as string) ?? '',
      source: e.source,
    }))
}

export function unifiedToAmphitheaters(entities: UnifiedEntity[]): Amphitheater[] {
  return entities
    .filter((e) => e.type === 'amphitheater')
    .map((e) => ({
      id: stripPrefix(e.id),
      name: e.name,
      lat: e.lat,
      lng: e.lng,
      capacity: (e.props?.capacity as number) ?? null,
      constructionYear: e.startYear ?? null,
      dimensions: (e.props?.dimensions as string) ?? null,
      city: (e.props?.city as string) ?? '',
      source: e.source,
      pleiadesId: null,
    }))
}

export function unifiedToBuildings(entities: UnifiedEntity[]): Building[] {
  return entities
    .filter((e) => e.type === 'building')
    .map((e) => ({
      id: stripPrefix(e.id),
      name: e.name,
      lat: e.lat,
      lng: e.lng,
      buildingType: e.subtype ?? 'unknown',
      constructionYear: e.startYear ?? 0,
      builder: (e.props?.builder as string) ?? null,
      description: (e.props?.description as string) ?? '',
      source: e.source,
    }))
}

export function unifiedToReligion(entities: UnifiedEntity[]): ReligiousSite[] {
  return entities
    .filter((e) => e.type === 'religious-site')
    .map((e) => ({
      id: stripPrefix(e.id),
      name: e.name,
      lat: e.lat,
      lng: e.lng,
      religion: (e.props?.religion as string) ?? 'unknown',
      siteType: e.subtype ?? 'unknown',
      deity: (e.props?.deity as string) ?? null,
      startYear: e.startYear ?? 0,
      endYear: e.endYear ?? 0,
      description: (e.props?.description as string) ?? '',
      source: e.source,
    }))
}
