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
  52: 'production',
  66: 'production',
  32: 'funerary',
  35: 'funerary',
  46: 'funerary',
  47: 'funerary',
  50: 'funerary',
  34: 'funerary',
  63: 'funerary',
  64: 'funerary',
  76: 'funerary',
  31: 'cities', // Iron Age Oppidum → cities
}

export const CATEGORY_STYLES: Record<SettlementCategory, { color: string; label: string }> = {
  cities: { color: '#f5e6c8', label: 'Cities & Settlements' },
  rural: { color: '#7ec87e', label: 'Rural / Villas' },
  military: { color: '#e85c4a', label: 'Military' },
  infrastructure: { color: '#6baed6', label: 'Infrastructure' },
  religious: { color: '#f0c040', label: 'Religious' },
  production: { color: '#c88c5a', label: 'Production & Industry' },
  funerary: { color: '#b07cc8', label: 'Funerary & Monuments' },
}

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
