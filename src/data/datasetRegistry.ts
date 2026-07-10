/**
 * Dataset registry — declarative config for the entity-atlas point layers.
 *
 * THE unified rework (2026-07-10): the registry entries ARE the atlas
 * categories. Each one renders a category chunk of the entity atlas
 * (src/data/entities/atlas/<id>.json, emitted from the canonical entity
 * table by scripts/build-entity-atlas.py) through the single AtlasLayer
 * renderer. The old per-source datasets (vici silo, Discovery
 * villas/temples/bridges/tombs, shipwrecks/mines/religion/ports/presses,
 * legacy amphitheater/buildings layers) all collapsed into these eight —
 * one dot per real-world entity, one popup path, one taxonomy.
 *
 * The store, layer renderer, UI panel, presets, persistence, and share
 * links all pick entries up automatically via `showDataset:<id>` keys.
 */

export interface DatasetConfig {
  id: string
  label: string
  group: string
  /** atlas category chunk name under src/data/entities/atlas/ */
  file: string

  color: string
  fillColor: string

  minZoom: number
  maxSample?: number

  temporalFilter: boolean

  activeClass: string
  attribution?: string
}

const SITE_ATTRIBUTION = 'Sites: vici.org (CC BY-SA) · DARE · Pleiades'

export const DATASET_REGISTRY: DatasetConfig[] = [
  {
    id: 'cities',
    label: 'Cities & Buildings',
    group: 'Sites',
    file: 'cities',
    color: '#8a7a55',
    fillColor: '#f5e6c8',
    minZoom: 6,
    temporalFilter: true,
    activeClass: 'bg-amber-900/80 border-amber-600 text-amber-100 hover:bg-amber-800/80',
    attribution: SITE_ATTRIBUTION,
  },
  {
    id: 'rural',
    label: 'Rural / Villas',
    group: 'Sites',
    file: 'rural',
    color: '#3f6b3f',
    fillColor: '#7ec87e',
    minZoom: 6,
    temporalFilter: true,
    activeClass: 'bg-lime-900/80 border-lime-700 text-lime-100 hover:bg-lime-800/80',
    attribution: SITE_ATTRIBUTION,
  },
  {
    id: 'military',
    label: 'Military',
    group: 'Sites',
    file: 'military',
    color: '#7a2e22',
    fillColor: '#e85c4a',
    minZoom: 6,
    temporalFilter: true,
    activeClass: 'bg-rose-900/80 border-rose-700 text-rose-100 hover:bg-rose-800/80',
    attribution: SITE_ATTRIBUTION,
  },
  {
    id: 'religious',
    label: 'Religious',
    group: 'Sites',
    file: 'religious',
    color: '#8a6d1c',
    fillColor: '#f0c040',
    minZoom: 6,
    temporalFilter: true,
    activeClass: 'bg-violet-900/80 border-violet-700 text-violet-100 hover:bg-violet-800/80',
    attribution: SITE_ATTRIBUTION,
  },
  {
    id: 'funerary',
    label: 'Funerary & Monuments',
    group: 'Sites',
    file: 'funerary',
    color: '#5e3a70',
    fillColor: '#b07cc8',
    minZoom: 6,
    temporalFilter: true,
    activeClass: 'bg-purple-900/80 border-purple-700 text-purple-100 hover:bg-purple-800/80',
    attribution: SITE_ATTRIBUTION,
  },
  {
    id: 'production',
    label: 'Production & Industry',
    group: 'Sites',
    file: 'production',
    color: '#6e4a2b',
    fillColor: '#c88c5a',
    minZoom: 6,
    temporalFilter: true,
    activeClass: 'bg-yellow-950/80 border-yellow-800 text-yellow-200 hover:bg-yellow-900/80',
    attribution: `${SITE_ATTRIBUTION} · DARMC/OxREP shipwrecks · OxREP mines · Ancient Ports`,
  },
  {
    id: 'infrastructure',
    label: 'Infrastructure',
    group: 'Sites',
    file: 'infrastructure',
    color: '#2d5a80',
    fillColor: '#6baed6',
    minZoom: 6,
    temporalFilter: true,
    activeClass: 'bg-sky-900/80 border-sky-700 text-sky-100 hover:bg-sky-800/80',
    attribution: SITE_ATTRIBUTION,
  },
  {
    // vici-only settlements (no place node) — drawn WITH the Settlements
    // toggle, not listed as a Sites category (group gates the panel/legend)
    id: 'settlement',
    label: 'Settlements',
    group: 'Urban',
    file: 'settlement',
    color: '#8a7a55',
    fillColor: '#f5e6c8',
    minZoom: 7,
    temporalFilter: true,
    activeClass: 'bg-yellow-900/80 border-yellow-700 text-yellow-100 hover:bg-yellow-800/80',
    attribution: SITE_ATTRIBUTION,
  },
]

export function getDataset(id: string): DatasetConfig | undefined {
  return DATASET_REGISTRY.find((d) => d.id === id)
}
