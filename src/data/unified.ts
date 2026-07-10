import type { Aqueduct } from '@/data/aqueducts'
import type { Battle } from '@/data/battles'
import type { Amphitheater } from '@/data/amphitheaters'
import type { Building } from '@/data/buildings'

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
    destroyedYear: e.destroyedYear,
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
    destroyedYear: e.destroyedYear,
    description: e.description ?? '',
    source: e.source,
  }))
}

const UNIFIED_LOADERS: Record<string, () => Promise<{ default: string }>> = {
  'press.json': () => import('@/data/unified/press.json?raw'),
  'shipwreck.json': () => import('@/data/unified/shipwreck.json?raw'),
  'mine.json': () => import('@/data/unified/mine.json?raw'),
  'religious-site.json': () => import('@/data/unified/religious-site.json?raw'),
  'port.json': () => import('@/data/unified/port.json?raw'),
  'battle.json': () => import('@/data/unified/battle.json?raw'),
  'amphitheater.json': () => import('@/data/unified/amphitheater.json?raw'),
  'building.json': () => import('@/data/unified/building.json?raw'),
  'aqueduct.json': () => import('@/data/unified/aqueduct.json?raw'),
  'discovery-villa.json': () => import('@/data/unified/discovery-villa.json?raw'),
  'discovery-temple.json': () => import('@/data/unified/discovery-temple.json?raw'),
  'discovery-bridge.json': () => import('@/data/unified/discovery-bridge.json?raw'),
  'discovery-tomb.json': () => import('@/data/unified/discovery-tomb.json?raw'),
}

export async function loadUnifiedDataset(file: string): Promise<UnifiedEntity[]> {
  const loader = UNIFIED_LOADERS[file]
  if (!loader) throw new Error(`Unknown unified dataset: ${file}`)
  return parseChunk(await loader())
}
