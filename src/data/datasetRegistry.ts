/**
 * Dataset registry — declarative config for point-data layers.
 *
 * Adding a new dataset:
 * 1. Drop a unified JSON file in src/data/unified/
 * 2. Add a DatasetConfig entry here
 * 3. The store, layer renderer, and UI panel pick it up automatically
 */

export interface DatasetConfig {
  id: string
  label: string
  group: string
  file: string

  color: string
  fillColor: string
  colorField?: string
  colorMap?: Record<string, string>

  minZoom: number
  maxSample?: number

  temporalFilter: boolean

  activeClass: string
  attribution?: string
}

export const DATASET_REGISTRY: DatasetConfig[] = [
  {
    id: 'presses',
    label: 'Oil & Wine Presses',
    group: 'Economy',
    file: 'press.json',
    color: '#4a3728',
    fillColor: '#8b6914',
    colorField: 'subtype',
    colorMap: {
      oil: '#8b6914',
      wine: '#722f37',
    },
    minZoom: 7,
    temporalFilter: true,
    activeClass: 'bg-yellow-950/80 border-yellow-800 text-yellow-200 hover:bg-yellow-900/80',
  },
  {
    id: 'shipwrecks',
    label: 'Shipwrecks',
    group: 'Economy',
    file: 'shipwreck.json',
    color: '#1a5276',
    fillColor: '#3498db',
    colorField: 'subtype',
    colorMap: {
      amphora: '#c0392b',
      marble: '#ecf0f1',
      grain: '#f39c12',
      metal: '#7f8c8d',
      mixed: '#8e44ad',
      'building materials': '#d4a574',
    },
    minZoom: 5,
    maxSample: 300,
    temporalFilter: true,
    activeClass: 'bg-cyan-900/80 border-cyan-700 text-cyan-100 hover:bg-cyan-800/80',
    attribution: 'Shipwreck data: DARMC/OxREP',
  },
  {
    id: 'mines',
    label: 'Mines & Quarries',
    group: 'Economy',
    file: 'mine.json',
    color: '#2c3e50',
    fillColor: '#95a5a6',
    colorField: 'subtype',
    colorMap: {
      gold: '#ffd700',
      silver: '#c0c0c0',
      copper: '#b87333',
      iron: '#434343',
      tin: '#d4d4d4',
      lead: '#5a5a5a',
      marble: '#f5f5f5',
      granite: '#a0785a',
      limestone: '#e8dcc8',
      porphyry: '#6a0dad',
    },
    minZoom: 6,
    temporalFilter: true,
    activeClass: 'bg-stone-800/80 border-stone-600 text-stone-100 hover:bg-stone-700/80',
    attribution: 'Mining data: OxREP',
  },
  {
    id: 'religion',
    label: 'Religious Sites',
    group: 'Religion',
    file: 'religious-site.json',
    color: '#2c3e50',
    fillColor: '#95a5a6',
    colorField: 'props.religion',
    colorMap: {
      roman: '#d4af37',
      greek: '#f0c040',
      egyptian: '#e67e22',
      christian: '#3498db',
      mithras: '#e74c3c',
      jewish: '#2ecc71',
      syncretic: '#9b59b6',
    },
    minZoom: 6,
    temporalFilter: true,
    activeClass: 'bg-violet-900/80 border-violet-700 text-violet-100 hover:bg-violet-800/80',
  },
  {
    id: 'ports',
    label: 'Ports & Harbours',
    group: 'Economy',
    file: 'port.json',
    color: '#1a5276',
    fillColor: '#2980b9',
    colorField: 'subtype',
    colorMap: {
      port: '#2980b9',
      harbour: '#3498db',
      naval_base: '#1a5276',
      anchorage: '#5dade2',
    },
    minZoom: 6,
    temporalFilter: true,
    activeClass: 'bg-blue-900/80 border-blue-600 text-blue-100 hover:bg-blue-800/80',
  },
  {
    id: 'villas',
    label: 'Villas (2.2K)',
    group: 'Discovery',
    file: 'discovery-villa.json',
    color: '#4d7c0f',
    fillColor: '#84cc16',
    minZoom: 5,
    temporalFilter: false,
    activeClass: 'bg-lime-900/80 border-lime-700 text-lime-100 hover:bg-lime-800/80',
  },
  {
    id: 'temples',
    label: 'Temples (1.3K)',
    group: 'Discovery',
    file: 'discovery-temple.json',
    color: '#86198f',
    fillColor: '#d946ef',
    minZoom: 5,
    temporalFilter: false,
    activeClass: 'bg-fuchsia-900/80 border-fuchsia-700 text-fuchsia-100 hover:bg-fuchsia-800/80',
  },
  {
    id: 'bridges',
    label: 'Bridges (689)',
    group: 'Discovery',
    file: 'discovery-bridge.json',
    color: '#0369a1',
    fillColor: '#38bdf8',
    minZoom: 5,
    temporalFilter: false,
    activeClass: 'bg-sky-900/80 border-sky-700 text-sky-100 hover:bg-sky-800/80',
  },
  {
    id: 'tombs',
    label: 'Tombs (780)',
    group: 'Discovery',
    file: 'discovery-tomb.json',
    color: '#374151',
    fillColor: '#9ca3af',
    minZoom: 5,
    temporalFilter: false,
    activeClass: 'bg-gray-800/80 border-gray-600 text-gray-100 hover:bg-gray-700/80',
  },
]

export function getDataset(id: string): DatasetConfig | undefined {
  return DATASET_REGISTRY.find((d) => d.id === id)
}
