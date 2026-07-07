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

export async function loadShipwrecks(): Promise<Shipwreck[]> {
  return parseChunk(await import('@/data/unified/shipwreck.json?raw')).map((e) => ({
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

export async function loadMines(): Promise<Mine[]> {
  return parseChunk(await import('@/data/unified/mine.json?raw')).map((e) => ({
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
    description: (e.props?.description as string) ?? '',
    source: e.source,
  }))
}

export async function loadPresses(): Promise<Press[]> {
  return parseChunk(await import('@/data/unified/press.json?raw')).map((e) => ({
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

export async function loadPorts(): Promise<PortData[]> {
  return parseChunk(await import('@/data/unified/port.json?raw')).map((e) => ({
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
    description: (e.props?.description as string) ?? '',
    source: e.source,
  }))
}

export async function loadAmphitheaters(): Promise<Amphitheater[]> {
  return parseChunk(await import('@/data/unified/amphitheater.json?raw')).map((e) => ({
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

export async function loadBuildings(): Promise<Building[]> {
  return parseChunk(await import('@/data/unified/building.json?raw')).map((e) => ({
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

export async function loadReligion(): Promise<ReligiousSite[]> {
  return parseChunk(await import('@/data/unified/religious-site.json?raw')).map((e) => ({
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

export async function loadDiscoveryVillas(): Promise<UnifiedEntity[]> {
  return parseChunk(await import('@/data/unified/discovery-villa.json?raw'))
}

export async function loadDiscoveryTemples(): Promise<UnifiedEntity[]> {
  return parseChunk(await import('@/data/unified/discovery-temple.json?raw'))
}

export async function loadDiscoveryBridges(): Promise<UnifiedEntity[]> {
  return parseChunk(await import('@/data/unified/discovery-bridge.json?raw'))
}

export async function loadDiscoveryTombs(): Promise<UnifiedEntity[]> {
  return parseChunk(await import('@/data/unified/discovery-tomb.json?raw'))
}
