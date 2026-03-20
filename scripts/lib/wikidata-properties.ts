/**
 * Wikidata property definitions per feature type.
 *
 * Each property includes its Wikidata ID, label, and which feature types it applies to.
 * The enrichment script uses these to build targeted SPARQL queries.
 */

export interface WikidataPropertyDef {
  id: string
  label: string
  featureTypes: FeatureType[]
  /** How to interpret the value (default: 'string') */
  valueType?: 'string' | 'year' | 'quantity' | 'coordinate' | 'item'
}

export type FeatureType = 'amphitheaters' | 'battles' | 'settlements' | 'buildings' | 'entities'

/**
 * Properties to query from Wikidata, grouped by purpose.
 * Only claims with references (P248 "stated in") are kept as "sourced".
 */
export const WIKIDATA_PROPERTIES: WikidataPropertyDef[] = [
  // --- Universal ---
  {
    id: 'P18',
    label: 'image',
    featureTypes: ['amphitheaters', 'battles', 'settlements', 'buildings'],
    valueType: 'string',
  },
  {
    id: 'P571',
    label: 'inception',
    featureTypes: ['amphitheaters', 'settlements', 'buildings'],
    valueType: 'year',
  },
  {
    id: 'P576',
    label: 'dissolved/destroyed',
    featureTypes: ['amphitheaters', 'settlements', 'buildings'],
    valueType: 'year',
  },
  {
    id: 'P1435',
    label: 'heritage designation',
    featureTypes: ['amphitheaters', 'settlements', 'buildings'],
    valueType: 'item',
  },
  {
    id: 'P1343',
    label: 'described by source',
    featureTypes: ['amphitheaters', 'battles', 'settlements', 'buildings'],
    valueType: 'item',
  },
  {
    id: 'P625',
    label: 'coordinate location',
    featureTypes: ['amphitheaters', 'battles', 'settlements', 'buildings'],
    valueType: 'coordinate',
  },

  // --- Physical (amphitheaters + buildings) ---
  {
    id: 'P186',
    label: 'material used',
    featureTypes: ['amphitheaters', 'buildings'],
    valueType: 'item',
  },
  {
    id: 'P2048',
    label: 'height',
    featureTypes: ['amphitheaters', 'buildings'],
    valueType: 'quantity',
  },
  {
    id: 'P2046',
    label: 'area',
    featureTypes: ['amphitheaters', 'buildings'],
    valueType: 'quantity',
  },
  {
    id: 'P1083',
    label: 'maximum capacity',
    featureTypes: ['amphitheaters'],
    valueType: 'quantity',
  },

  // --- Buildings ---
  { id: 'P84', label: 'architect', featureTypes: ['buildings'], valueType: 'item' },
  { id: 'P88', label: 'commissioned by', featureTypes: ['buildings'], valueType: 'item' },
  { id: 'P149', label: 'architectural style', featureTypes: ['buildings'], valueType: 'item' },

  // --- Battles ---
  { id: 'P710', label: 'participant', featureTypes: ['battles'], valueType: 'item' },
  { id: 'P1120', label: 'number of deaths', featureTypes: ['battles'], valueType: 'quantity' },
  { id: 'P1346', label: 'winner', featureTypes: ['battles'], valueType: 'item' },

  // --- Settlements ---
  { id: 'P31', label: 'instance of', featureTypes: ['settlements'], valueType: 'item' },
  { id: 'P17', label: 'country', featureTypes: ['settlements'], valueType: 'item' },
]

/** Get relevant properties for a given feature type */
export function getPropertiesForType(type: FeatureType): WikidataPropertyDef[] {
  return WIKIDATA_PROPERTIES.filter((p) => p.featureTypes.includes(type))
}

/** Build a SPARQL VALUES clause for property IDs */
export function buildPropertyValues(props: WikidataPropertyDef[]): string {
  return props.map((p) => `wdt:${p.id}`).join(' ')
}
