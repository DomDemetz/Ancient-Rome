export const DARE_TYPE_LABELS: Record<number, string> = {
  11: 'Major Settlement',
  12: 'Settlement',
  13: 'Civitas Capital',
  14: 'Villa',
  15: 'Village',
  16: 'Road Station',
  17: 'Legionary Fortress',
  18: 'Fort',
  19: 'Farm / Rural',
  21: 'Monastery',
  24: 'Church',
  31: 'Iron Age Oppidum',
  32: 'Tumulus',
  34: 'Arch / Trophy',
  35: 'Late Roman Fortification',
  43: 'Temple',
  46: 'Bath',
  47: 'Aqueduct',
  49: 'Pass',
  50: 'Mausoleum',
  51: 'Bridge',
  52: 'Dam / Reservoir',
  53: 'Fortlet / Tower',
  55: 'Road / Milestone',
  57: 'Mine / Quarry',
  58: 'Kiln / Workshop',
  61: 'Sanctuary',
  63: 'Cemetery',
  64: 'Monument',
  66: 'Findspot',
  76: 'Lighthouse',
}

/** DARE types that ARE settlements — the only types PlacesLayer renders.
 *  Every other DARE type is a structure and renders through the entity
 *  atlas (Sites categories); build-entity-atlas.py mirrors this set. */
export const SETTLEMENT_DARE_TYPES = new Set([11, 12, 13, 15, 31])

/** structural DARE type → siteType slug for SITE_TYPE_TO_LAYER routing
 *  (search selects a node → the matching Sites category toggles on) */
export const DARE_TYPE_TO_SITE_TYPE: Record<number, string> = {
  14: 'villa',
  19: 'farm',
  16: 'road-station',
  49: 'pass',
  51: 'bridge',
  55: 'road',
  46: 'bath',
  47: 'aqueduct',
  52: 'dam',
  76: 'lighthouse',
  17: 'legionary-fortress',
  18: 'fort',
  35: 'fortification',
  53: 'watchtower',
  21: 'monastery',
  24: 'church',
  43: 'temple',
  61: 'sanctuary',
  57: 'mine',
  58: 'workshop',
  66: 'findspot',
  32: 'tumulus',
  34: 'monument',
  50: 'mausoleum',
  63: 'cemetery',
  64: 'monument',
}

export type SettlementCategory =
  | 'cities'
  | 'rural'
  | 'military'
  | 'infrastructure'
  | 'religious'
  | 'production'
  | 'funerary'

export const DARE_TYPE_TO_CATEGORY: Record<number, SettlementCategory> = {
  11: 'cities',
  12: 'cities',
  13: 'cities',
  15: 'cities',
  14: 'rural',
  19: 'rural',
  17: 'military',
  18: 'military',
  53: 'military',
  16: 'infrastructure',
  49: 'infrastructure',
  51: 'infrastructure',
  55: 'infrastructure',
  21: 'religious',
  24: 'religious',
  61: 'religious',
  43: 'religious',
  57: 'production',
  58: 'production',
  // 52 is aqueduct infrastructure, not production — every type-52 row in the
  // data is an aqueduct, spring source, or aqueduct bridge (Jouy-aux-Arches,
  // Grüner Pütz, Fontaine d'Eure). Audited 2026-07-08.
  52: 'infrastructure',
  66: 'production',
  35: 'military', // Late Roman Fortification
  46: 'infrastructure', // Bath
  47: 'infrastructure', // Aqueduct
  76: 'infrastructure', // Lighthouse
  32: 'funerary', // Tumulus
  50: 'funerary', // Mausoleum
  34: 'funerary', // Arch / Trophy
  63: 'funerary', // Cemetery
  64: 'funerary', // Monument
  31: 'cities', // Iron Age Oppidum → cities
}

// THE palette lives in taxonomy.json — this map derives from it so the
// legacy settlement categories can never drift from the atlas colors
import taxonomyJson from '@/data/taxonomy.json'
const TAX_CATEGORIES = (
  taxonomyJson as unknown as {
    categories: Record<string, { label: string; color: string; fill: string }>
  }
).categories

export const CATEGORY_STYLES: Record<SettlementCategory, { color: string; label: string }> =
  Object.fromEntries(
    (
      [
        'cities',
        'rural',
        'military',
        'infrastructure',
        'religious',
        'production',
        'funerary',
      ] as const
    ).map((c) => [c, { color: TAX_CATEGORIES[c].fill, label: TAX_CATEGORIES[c].label }]),
  ) as Record<SettlementCategory, { color: string; label: string }>

export const ALL_CATEGORIES: SettlementCategory[] = [
  'cities',
  'rural',
  'military',
  'infrastructure',
  'religious',
  'production',
  'funerary',
]

export function getSettlementStyle(
  type: number,
  major: boolean,
  zoom: number,
): { color: string; radius: number } {
  const category = DARE_TYPE_TO_CATEGORY[type] ?? 'cities'
  const color = CATEGORY_STYLES[category].color

  const isMajor = major || type === 11 || type === 17
  const radius = isMajor ? (zoom >= 7 ? 4 : 3) : zoom >= 7 ? 3 : 2

  return { color, radius }
}
