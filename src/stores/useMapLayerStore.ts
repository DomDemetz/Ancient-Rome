import { create } from 'zustand'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useMapNavStore } from '@/stores/useMapNavStore'
import type { FeatureCollection } from 'geojson'
import type { ProvinceLabel, ProvinceChange } from '@/data/dare'
import type { PlaceNode } from '@/data/places'
import type { EmpireShape } from '@/data/empires'
import type { PresenceGrid } from '@/features/map/layers/PresenceLayer'
import type { SettlementCategory } from '@/features/map/layers/settlementStyles'
import type { Battle } from '@/data/battles'
import type { Emperor } from '@/data/emperors'
import type { Legion } from '@/data/legions'
import type { TradeNetwork } from '@/data/trade'
import type { EpigraphyCluster } from '@/data/epigraphy'
import type { NotablePerson } from '@/data/people-layer'
import type { AtlasEntity } from '@/data/entities/atlas'
import { DATASET_REGISTRY } from '@/data/datasetRegistry'

// --- Preset definitions ---
export type PresetName =
  | 'conquest'
  | 'economy'
  | 'gods'
  | 'riseAndFall'
  | 'engineering'
  | 'byzantine'
  | 'world'
  | 'custom'

export interface PresetDef {
  label: string
  description: string
  layers: string[]
  timelineYear?: number
  /** Start the timeline playing on activation (time-lapse presets). */
  autoplay?: boolean
  /** Fly here on activation. A preset whose star content is zoom-gated
   *  (temples render from z7) must open where that content EXISTS —
   *  Gods & Temples at world zoom showed provinces and zero temples. */
  view?: { lat: number; lng: number; zoom: number }
}

export const PRESETS: Record<Exclude<PresetName, 'custom'>, PresetDef> = {
  conquest: {
    label: 'The Conquest',
    description: 'Watch Rome conquer the Mediterranean',
    timelineYear: -200,
    // Presence (the density grid) is intentionally left out — it clutters the
    // first-open view. It stays available as a manual toggle in the panel.
    layers: ['showBattles', 'showLegions', 'showLimes', 'showFortifications', 'showRoads'],
  },
  economy: {
    label: 'The Economy',
    description: 'The commercial engine of empire',
    timelineYear: 100,
    layers: [
      'showRoads',
      'showItinereRoads',
      'showSettlements',
      'showDataset:settlement',
      'showCities',
      'showDataset:mine',
      'showDataset:press',
      'showDataset:shipwreck',
      'showDataset:port',
      'showTradeNetwork',
    ],
  },
  gods: {
    label: 'Gods & Temples',
    description: 'From Jupiter to Christ — religious transformation',
    timelineYear: 200,
    // temple country at temple zoom — the dataset is z7-gated
    view: { lat: 41.7, lng: 13.0, zoom: 7 },
    layers: [
      'showDataset:temple',
      'showDataset:sanctuary',
      'showDataset:church',
      'showSettlements',
      'showDataset:settlement',
      'showCities',
      'showProvinces',
      'showEpigraphy',
      'showRoads',
    ],
  },
  riseAndFall: {
    label: 'Rise & Fall',
    description: 'The full puzzle assembled — scrub 753 BC to 476 AD',
    timelineYear: -753,
    // 753 BC is an empty map by design — the preset IS the time-lapse, so
    // it starts itself instead of opening on a void and hoping for play.
    autoplay: true,
    layers: [
      'showBattles',
      'showLegions',
      'showEmperors',
      'showRoads',
      'showSettlements',
      'showDataset:settlement',
      'showCities',
      'showProvinces',
      'showLimes',
      'showFortifications',
      'showDataset:amphitheater',
      'showDataset:theater',
      'showDataset:shipwreck',
      'showDataset:temple',
    ],
  },
  engineering: {
    label: 'Engineering Marvel',
    description: 'How Romans built a civilization',
    timelineYear: 100,
    layers: [
      'showRoads',
      'showItinereRoads',
      'showSettlements',
      'showDataset:settlement',
      'showCities',
      'showDataset:amphitheater',
      'showDataset:theater',
      'showAqueducts',
      'showDataset:bridge',
      'showDataset:bath',
      'showWater',
    ],
  },
  world: {
    label: 'The World',
    description: 'Every empire on earth — Rome among the powers, 753 BC to 1453',
    timelineYear: 550,
    layers: ['showEmpires', 'showCities', 'showEmperors', 'showRoads'],
  },
  byzantine: {
    label: 'Byzantium',
    description: 'The Eastern Empire endures — 476 to the fall of Constantinople, 1453',
    timelineYear: 600,
    // Cities + the enduring road/trade network keep the medieval map alive
    // (settlements hand off to the Chandler cities past ~800).
    layers: [
      'showSettlements',
      'showDataset:settlement',
      'showCities',
      'showRoads',
      'showTradeNetwork',
      'showBattles',
      'showEmperors',
    ],
  },
}

// --- Layer group definitions ---
export interface LayerGroup {
  label: string
  layers: { key: string; label: string; activeClass: string }[]
}

export const LAYER_GROUPS: LayerGroup[] = [
  {
    label: 'Political',
    layers: [
      {
        key: 'Empires',
        label: 'World Empires',
        activeClass: 'bg-indigo-900/80 border-indigo-600 text-indigo-100 hover:bg-indigo-800/80',
      },
      {
        key: 'Territories',
        label: 'Roman Territories',
        activeClass: 'bg-red-900/80 border-red-700 text-red-100 hover:bg-red-800/80',
      },
      {
        key: 'Provinces',
        label: 'Provinces',
        activeClass: 'bg-purple-900/80 border-purple-700 text-purple-100 hover:bg-purple-800/80',
      },
      {
        key: 'Emperors',
        label: 'Emperors',
        activeClass: 'bg-amber-900/80 border-amber-600 text-amber-100 hover:bg-amber-800/80',
      },
    ],
  },
  {
    label: 'Military',
    layers: [
      {
        key: 'Battles',
        label: 'Battles',
        activeClass: 'bg-rose-900/80 border-rose-700 text-rose-100 hover:bg-rose-800/80',
      },
      {
        key: 'Legions',
        label: 'Legions',
        activeClass: 'bg-red-900/80 border-red-600 text-red-100 hover:bg-red-800/80',
      },
      {
        key: 'Fortifications',
        label: 'Fortifications',
        activeClass: 'bg-orange-900/80 border-orange-700 text-orange-100 hover:bg-orange-800/80',
      },
      {
        key: 'Limes',
        label: 'Limes',
        activeClass: 'bg-rose-900/80 border-rose-700 text-rose-100 hover:bg-rose-800/80',
      },
      {
        key: 'IslamicConquests',
        label: 'Islamic Conquests',
        activeClass:
          'bg-emerald-900/80 border-emerald-700 text-emerald-100 hover:bg-emerald-800/80',
      },
      {
        key: 'Presence',
        label: 'Presence',
        activeClass: 'bg-stone-800/80 border-stone-600 text-stone-100 hover:bg-stone-700/80',
      },
    ],
  },
  {
    label: 'Urban',
    layers: [
      {
        key: 'Cities',
        label: 'Major Cities',
        activeClass: 'bg-amber-900/80 border-amber-600 text-amber-100 hover:bg-amber-800/80',
      },
      {
        key: 'Settlements',
        label: 'Settlements',
        activeClass: 'bg-yellow-900/80 border-yellow-700 text-yellow-100 hover:bg-yellow-800/80',
      },
      {
        key: 'Epigraphy',
        label: 'Epigraphy',
        activeClass: 'bg-yellow-900/80 border-yellow-700 text-yellow-100 hover:bg-yellow-800/80',
      },
      {
        key: 'NotablePeople',
        label: 'Notable People',
        activeClass: 'bg-indigo-900/80 border-indigo-700 text-indigo-100 hover:bg-indigo-800/80',
      },
    ],
  },
  {
    label: 'Economy',
    layers: [
      {
        key: 'TradeNetwork',
        label: 'Trade Network',
        activeClass: 'bg-teal-900/80 border-teal-700 text-teal-100 hover:bg-teal-800/80',
      },
    ],
  },
  {
    label: 'Religion',
    layers: [],
  },
  {
    label: 'Roads',
    layers: [
      {
        key: 'Roads',
        label: 'Roads',
        activeClass: 'bg-amber-900/80 border-amber-700 text-amber-100 hover:bg-amber-800/80',
      },
      {
        key: 'ItinereRoads',
        label: 'Itiner-e Roads',
        activeClass: 'bg-orange-950/80 border-orange-800 text-orange-200 hover:bg-orange-900/80',
      },
    ],
  },
  {
    label: 'Infrastructure',
    layers: [
      {
        key: 'Aqueducts',
        label: 'Aqueduct Lines',
        activeClass: 'bg-blue-900/80 border-blue-700 text-blue-100 hover:bg-blue-800/80',
      },
      {
        key: 'Water',
        label: 'Water',
        activeClass: 'bg-blue-900/80 border-blue-700 text-blue-100 hover:bg-blue-800/80',
      },
    ],
  },
]

// One panel toggle per atlas kind (the toggles ARE the things): registry
// entries slot into their overall group; '_hidden' kinds (settlement) are
// drawn by another toggle and stay out of the panel.
for (const cfg of DATASET_REGISTRY) {
  if (cfg.group === '_hidden') continue
  const group = LAYER_GROUPS.find((g) => g.label === cfg.group)
  if (group) {
    group.layers.push({ key: `Sites:${cfg.id}`, label: cfg.label, activeClass: cfg.activeClass })
  }
}

// --- All toggleable layer keys ---
export const ALL_LAYER_KEYS = [
  'showRoads',
  'showSettlements',
  'showCities',
  'showEmpires',
  'showLimes',
  'showIslamicConquests',
  'showPresence',
  'showProvinces',
  'showFortifications',
  'showWater',
  'showItinereRoads',
  'showBattles',
  'showEmperors',
  'showLegions',
  'showAqueducts',
  'showTradeNetwork',
  'showEpigraphy',
  'showNotablePeople',
] as const

interface MapLayerState {
  // Existing layers
  showRoads: boolean
  showSettlements: boolean
  showCities: boolean
  showEmpires: boolean
  empiresData: EmpireShape[] | null
  empiresLoading: boolean
  showLimes: boolean
  showIslamicConquests: boolean
  showPresence: boolean
  showProvinces: boolean
  showFortifications: boolean
  showWater: boolean
  showItinereRoads: boolean
  roadsData: FeatureCollection | null
  placesData: PlaceNode[] | null
  limesData: FeatureCollection | null
  islamicConquestsData: FeatureCollection | null
  presenceData: PresenceGrid | null
  provincesData: FeatureCollection | null
  provinceLabels: ProvinceLabel[] | null
  provinceChanges: ProvinceChange[] | null
  fortificationsData: FeatureCollection | null
  waterData: FeatureCollection | null
  itinereRoadsData: FeatureCollection | null
  roadsLoading: boolean
  placesLoading: boolean
  limesLoading: boolean
  islamicConquestsLoading: boolean
  presenceLoading: boolean
  provincesLoading: boolean
  fortificationsLoading: boolean
  waterLoading: boolean
  itinereRoadsLoading: boolean

  // Wave 1 layers
  showBattles: boolean
  battlesData: Battle[] | null
  battlesLoading: boolean
  showEmperors: boolean
  emperorsData: Emperor[] | null
  emperorsLoading: boolean

  // Wave 2 layers
  showLegions: boolean
  legionsData: Legion[] | null
  legionsLoading: boolean
  showAqueducts: boolean
  aqueductLinesData: FeatureCollection | null
  aqueductsLoading: boolean
  senatorialProvincesData: FeatureCollection | null

  // Wave 3 layers
  showTradeNetwork: boolean
  tradeNetworkData: TradeNetwork | null
  tradeNetworkLoading: boolean
  showEpigraphy: boolean
  epigraphyData: EpigraphyCluster[] | null
  epigraphyLoading: boolean
  showNotablePeople: boolean
  notablePeopleData: NotablePerson[] | null
  notablePeopleLoading: boolean

  // Registry-driven datasets
  datasetState: Record<string, { show: boolean; data: AtlasEntity[] | null; loading: boolean }>

  // Settlement filtering
  settlementTypes: Record<number, boolean>
  hiddenCategories: Set<string>

  // Presets
  activePreset: PresetName

  // Error state
  loadError: string | null
}

interface MapLayerActions {
  toggleRoads: () => void
  toggleSettlements: () => void
  toggleCities: () => void
  toggleEmpires: () => void
  toggleLimes: () => void
  toggleIslamicConquests: () => void
  togglePresence: () => void
  toggleProvinces: () => void
  toggleFortifications: () => void
  toggleWater: () => void
  toggleItinereRoads: () => void
  toggleSettlementType: (type: number) => void
  toggleCategory: (category: SettlementCategory) => void
  toggleBattles: () => void
  toggleEmperors: () => void
  toggleLegions: () => void
  toggleAqueducts: () => void
  toggleTradeNetwork: () => void
  toggleEpigraphy: () => void
  toggleNotablePeople: () => void
  toggleDataset: (id: string) => void
  activatePreset: (preset: PresetName) => void
  setLayers: (keys: string[]) => void
  dismissError: () => void
}

// Settlements draws only true settlement types — every structural DARE
// type (villa, sanctuary, mine, fort...) renders through the entity atlas
// so the panel has ONE taxonomy for structures (see settlementStyles.ts)
const ALL_SETTLEMENT_TYPES = [11, 12, 13, 15, 31] as const
const defaultSettlementTypes: Record<number, boolean> = Object.fromEntries(
  ALL_SETTLEMENT_TYPES.map((t) => [t, true]),
)

// Helper to create a standard lazy-loading toggle.
// Keys are constrained to actual MapLayerState properties for type safety.
type StoreSet = (s: Partial<MapLayerState>) => void
type StoreGet = () => MapLayerState

function makeToggle(
  showKey: keyof MapLayerState,
  dataKey: keyof MapLayerState,
  loadingKey: keyof MapLayerState,
  loader: () => Promise<{ data: unknown; extra?: Partial<MapLayerState> }>,
) {
  return async (set: StoreSet, get: StoreGet) => {
    const state = get()
    const show = state[showKey] as boolean
    const data = state[dataKey]
    const loading = state[loadingKey] as boolean

    if (show) {
      set({ [showKey]: false, activePreset: 'custom' } as Partial<MapLayerState>)
      return
    }
    if (data != null) {
      set({ [showKey]: true, activePreset: 'custom' } as Partial<MapLayerState>)
      return
    }
    if (loading) return

    set({ [loadingKey]: true } as Partial<MapLayerState>)
    try {
      const result = await loader()
      set({
        [dataKey]: result.data,
        [showKey]: true,
        [loadingKey]: false,
        activePreset: 'custom',
        ...result.extra,
      } as Partial<MapLayerState>)
    } catch (err) {
      console.error(`Failed to load ${String(showKey)}:`, err)
      const label = String(showKey).replace('show', '')
      set({
        [loadingKey]: false,
        loadError: `Failed to load ${label} layer`,
      } as Partial<MapLayerState>)
    }
  }
}

// Ensure layer data is loaded (for preset activation). Reuses the same loader
// functions as toggles but only loads — never toggles off.
function ensureLoaded(
  dataKey: keyof MapLayerState,
  loadingKey: keyof MapLayerState,
  loader: () => Promise<Partial<MapLayerState>>,
) {
  return async (set: StoreSet, get: StoreGet) => {
    if (get()[dataKey] != null || (get()[loadingKey] as boolean)) return
    set({ [loadingKey]: true } as Partial<MapLayerState>)
    try {
      const result = await loader()
      set({ ...result, [loadingKey]: false } as Partial<MapLayerState>)
    } catch (err) {
      console.error(`Preset load failed for ${String(dataKey)}:`, err)
      set({ [loadingKey]: false } as Partial<MapLayerState>)
    }
  }
}

// Compact loader registry: maps each showKey to an ensureLoaded call.
// Shared by activatePreset (preset activation) and setLayers (story steps).
const LAYER_LOADERS: Record<string, (set: StoreSet, get: StoreGet) => Promise<void>> = {
  showRoads: ensureLoaded('roadsData', 'roadsLoading', async () => {
    const { loadRoads } = await import('@/data/dare')
    return { roadsData: await loadRoads() }
  }),
  showSettlements: ensureLoaded('placesData', 'placesLoading', async () => {
    // core tier paints the empire-zoom dots instantly (~0.5 MB); the 5.6 MB
    // minor/gazetteer tier (zoom 7+) streams in behind it
    const { loadPlacesCore, loadPlacesDetail } = await import('@/data/places')
    const core = await loadPlacesCore()
    loadPlacesDetail()
      .then((detail) => {
        const cur = useMapLayerStore.getState().placesData ?? []
        const have = new Set(cur.map((p) => p.id))
        useMapLayerStore.setState({
          placesData: [...cur, ...detail.filter((p) => !have.has(p.id))],
        })
      })
      .catch((err) => console.error('places detail tier failed:', err))
    return { placesData: core }
  }),
  showCities: ensureLoaded('placesData', 'placesLoading', async () => {
    // core tier paints the empire-zoom dots instantly (~0.5 MB); the 5.6 MB
    // minor/gazetteer tier (zoom 7+) streams in behind it
    const { loadPlacesCore, loadPlacesDetail } = await import('@/data/places')
    const core = await loadPlacesCore()
    loadPlacesDetail()
      .then((detail) => {
        const cur = useMapLayerStore.getState().placesData ?? []
        const have = new Set(cur.map((p) => p.id))
        useMapLayerStore.setState({
          placesData: [...cur, ...detail.filter((p) => !have.has(p.id))],
        })
      })
      .catch((err) => console.error('places detail tier failed:', err))
    return { placesData: core }
  }),
  showEmpires: ensureLoaded('empiresData', 'empiresLoading', async () => {
    // progressive: paint the CURRENT era's polities first (~2-5 MB), then
    // pull the remaining era buckets in the background so playback and
    // scrubbing across the full 3400 BC – 2024 AD span still find every shape
    const { loadEmpiresEra, empireEraIndex, dedupeEmpires, EMPIRE_ERAS } =
      await import('@/data/empires')
    const first = empireEraIndex(useTimelineStore.getState().currentYear)
    const firstBatch = await loadEmpiresEra(first)
    const rest = EMPIRE_ERAS.map((_, i) => i).filter((i) => i !== first)
    Promise.all(rest.map((i) => loadEmpiresEra(i)))
      .then((batches) => {
        const current = useMapLayerStore.getState().empiresData
        useMapLayerStore.setState({
          empiresData: dedupeEmpires(current ?? firstBatch, ...batches),
        })
      })
      .catch((err) => console.error('empires background load failed:', err))
    return { empiresData: firstBatch }
  }),
  showLimes: ensureLoaded('limesData', 'limesLoading', async () => {
    const { loadLimes } = await import('@/data/dare')
    return { limesData: await loadLimes() }
  }),
  showIslamicConquests: ensureLoaded(
    'islamicConquestsData',
    'islamicConquestsLoading',
    async () => {
      const { loadIslamicConquests } = await import('@/data/dare')
      return { islamicConquestsData: await loadIslamicConquests() }
    },
  ),
  showPresence: ensureLoaded('presenceData', 'presenceLoading', async () => {
    const { loadPresenceGrid } = await import('@/data/dare')
    return { presenceData: await loadPresenceGrid() }
  }),
  showProvinces: ensureLoaded('provincesData', 'provincesLoading', async () => {
    const { loadProvinces, loadProvinceLabels, loadProvinceChanges } = await import('@/data/dare')
    const [d, l, c, senatorial] = await Promise.all([
      loadProvinces(),
      loadProvinceLabels(),
      loadProvinceChanges().catch(() => []),
      import('@/data/dare/senatorial-provinces.json')
        .then((m) => m.default as FeatureCollection)
        .catch(() => null),
    ])
    return {
      provincesData: d,
      provinceLabels: l,
      provinceChanges: c,
      senatorialProvincesData: senatorial,
    }
  }),
  showFortifications: ensureLoaded('fortificationsData', 'fortificationsLoading', async () => {
    const { loadFortifications } = await import('@/data/dare')
    return { fortificationsData: await loadFortifications() }
  }),
  showWater: ensureLoaded('waterData', 'waterLoading', async () => {
    const { loadWater } = await import('@/data/dare')
    return { waterData: await loadWater() }
  }),
  showItinereRoads: ensureLoaded('itinereRoadsData', 'itinereRoadsLoading', async () => {
    const { loadItinereRoads } = await import('@/data/itinere')
    return { itinereRoadsData: await loadItinereRoads() }
  }),
  showBattles: ensureLoaded('battlesData', 'battlesLoading', async () => {
    const { loadBattles } = await import('@/data/unified')
    return { battlesData: await loadBattles() }
  }),
  showEmperors: ensureLoaded('emperorsData', 'emperorsLoading', async () => {
    const { loadEmperors } = await import('@/data/emperors')
    return { emperorsData: await loadEmperors() }
  }),
  showLegions: ensureLoaded('legionsData', 'legionsLoading', async () => {
    const { loadLegions } = await import('@/data/legions')
    return { legionsData: await loadLegions() }
  }),
  showAqueducts: ensureLoaded('aqueductLinesData', 'aqueductsLoading', async () => {
    const lines = await import('@/data/awmc-aqueducts-temporal.json')
      .then((m) => m.default as FeatureCollection)
      .catch(() => null)
    return { aqueductLinesData: lines }
  }),
  showTradeNetwork: ensureLoaded('tradeNetworkData', 'tradeNetworkLoading', async () => {
    const { loadTradeNetwork } = await import('@/data/trade')
    return { tradeNetworkData: await loadTradeNetwork() }
  }),
  showEpigraphy: ensureLoaded('epigraphyData', 'epigraphyLoading', async () => {
    const { loadEpigraphy } = await import('@/data/epigraphy')
    return { epigraphyData: await loadEpigraphy() }
  }),
  showNotablePeople: ensureLoaded('notablePeopleData', 'notablePeopleLoading', async () => {
    const { loadNotablePeople } = await import('@/data/people-layer')
    return { notablePeopleData: await loadNotablePeople() }
  }),
}

/** Load a dataset chunk into datasetState (idempotent; the ONE loader all
 *  four call sites share — panel toggle, preset, story, persisted restore). */
async function loadDatasetInto(
  set: StoreSet,
  get: StoreGet,
  dsId: string,
  show: boolean,
): Promise<void> {
  const ds = get().datasetState[dsId]
  if (!ds || ds.data != null || ds.loading) return
  set({
    datasetState: { ...get().datasetState, [dsId]: { ...ds, loading: true } },
  } as Partial<MapLayerState>)
  try {
    const { loadAtlasCategory } = await import('@/data/entities/atlas')
    const cfg = DATASET_REGISTRY.find((d) => d.id === dsId)
    if (!cfg) return
    const data = await loadAtlasCategory(cfg.file)
    set({
      datasetState: {
        ...get().datasetState,
        [dsId]: { show, data, loading: false },
      },
    } as Partial<MapLayerState>)
  } catch (err) {
    console.error(`Dataset load failed: ${dsId}`, err)
    set({
      datasetState: {
        ...get().datasetState,
        [dsId]: { ...get().datasetState[dsId], loading: false },
      },
      loadError: `Failed to load ${dsId} layer`,
    } as Partial<MapLayerState>)
  }
}

// Add registry-driven dataset loaders for preset/story support
for (const ds of DATASET_REGISTRY) {
  LAYER_LOADERS[`showDataset:${ds.id}`] = (set: StoreSet, get: StoreGet) =>
    loadDatasetInto(set, get, ds.id, true)
}

export const useMapLayerStore = create<MapLayerState & MapLayerActions>((set, get) => ({
  // --- Initial state ---
  showRoads: true,
  roadsData: null,
  roadsLoading: false,
  showSettlements: false,
  showCities: false,
  showEmpires: false,
  empiresData: null,
  empiresLoading: false,
  placesData: null,
  placesLoading: false,
  showLimes: false,
  limesData: null,
  limesLoading: false,
  showIslamicConquests: false,
  islamicConquestsData: null,
  islamicConquestsLoading: false,
  showPresence: false,
  presenceData: null,
  presenceLoading: false,
  showProvinces: false,
  provincesData: null,
  provinceLabels: null,
  provinceChanges: null,
  provincesLoading: false,
  showFortifications: false,
  fortificationsData: null,
  fortificationsLoading: false,
  showWater: false,
  waterData: null,
  waterLoading: false,
  showItinereRoads: false,
  itinereRoadsData: null,
  itinereRoadsLoading: false,
  showBattles: false,
  battlesData: null,
  battlesLoading: false,
  showEmperors: false,
  emperorsData: null,
  emperorsLoading: false,
  showLegions: false,
  legionsData: null,
  legionsLoading: false,
  showAqueducts: false,
  aqueductLinesData: null,
  aqueductsLoading: false,
  senatorialProvincesData: null,
  showTradeNetwork: false,
  tradeNetworkData: null,
  tradeNetworkLoading: false,
  showEpigraphy: false,
  epigraphyData: null,
  epigraphyLoading: false,
  showNotablePeople: false,
  notablePeopleData: null,
  notablePeopleLoading: false,
  datasetState: Object.fromEntries(
    DATASET_REGISTRY.map((d) => [d.id, { show: false, data: null, loading: false }]),
  ),
  settlementTypes: { ...defaultSettlementTypes },
  hiddenCategories: new Set<string>(),
  activePreset: 'custom',
  loadError: null as string | null,
  dismissError: () => set({ loadError: null }),

  // --- Toggles ---
  toggleRoads: () =>
    makeToggle('showRoads', 'roadsData', 'roadsLoading', async () => {
      const { loadRoads } = await import('@/data/dare')
      return { data: await loadRoads() }
    })(set, get),

  toggleSettlements: () =>
    makeToggle('showSettlements', 'placesData', 'placesLoading', async () => {
      // core tier paints the empire-zoom dots instantly (~0.5 MB); the 5.6 MB
      // minor/gazetteer tier (zoom 7+) streams in behind it
      const { loadPlacesCore, loadPlacesDetail } = await import('@/data/places')
      const core = await loadPlacesCore()
      loadPlacesDetail()
        .then((detail) => {
          const cur = useMapLayerStore.getState().placesData ?? []
          const have = new Set(cur.map((p) => p.id))
          useMapLayerStore.setState({
            placesData: [...cur, ...detail.filter((p) => !have.has(p.id))],
          })
        })
        .catch((err) => console.error('places detail tier failed:', err))
      return { data: core }
    })(set, get),

  toggleCities: () =>
    makeToggle('showCities', 'placesData', 'placesLoading', async () => {
      // core tier paints the empire-zoom dots instantly (~0.5 MB); the 5.6 MB
      // minor/gazetteer tier (zoom 7+) streams in behind it
      const { loadPlacesCore, loadPlacesDetail } = await import('@/data/places')
      const core = await loadPlacesCore()
      loadPlacesDetail()
        .then((detail) => {
          const cur = useMapLayerStore.getState().placesData ?? []
          const have = new Set(cur.map((p) => p.id))
          useMapLayerStore.setState({
            placesData: [...cur, ...detail.filter((p) => !have.has(p.id))],
          })
        })
        .catch((err) => console.error('places detail tier failed:', err))
      return { data: core }
    })(set, get),

  toggleEmpires: () =>
    makeToggle('showEmpires', 'empiresData', 'empiresLoading', async () => {
      const { loadEmpires } = await import('@/data/empires')
      return { data: await loadEmpires() }
    })(set, get),

  toggleLimes: () =>
    makeToggle('showLimes', 'limesData', 'limesLoading', async () => {
      const { loadLimes } = await import('@/data/dare')
      return { data: await loadLimes() }
    })(set, get),

  toggleIslamicConquests: async () => {
    await makeToggle(
      'showIslamicConquests',
      'islamicConquestsData',
      'islamicConquestsLoading',
      async () => {
        const { loadIslamicConquests } = await import('@/data/dare')
        return { data: await loadIslamicConquests() }
      },
    )(set, get)
    // Bounded story layer: every wave starts 622+, so at Roman years the
    // toggle would light up an EMPTY map ("I cannot see it") — meet the
    // viewer at the first conquests instead, like presets set their year.
    if (get().showIslamicConquests && useTimelineStore.getState().currentYear < 622) {
      useTimelineStore.getState().setYear(632)
    }
  },

  togglePresence: () =>
    makeToggle('showPresence', 'presenceData', 'presenceLoading', async () => {
      const { loadPresenceGrid } = await import('@/data/dare')
      return { data: await loadPresenceGrid() }
    })(set, get),

  toggleProvinces: () =>
    makeToggle('showProvinces', 'provincesData', 'provincesLoading', async () => {
      const { loadProvinces, loadProvinceLabels, loadProvinceChanges } = await import('@/data/dare')
      const [data, labels, changes, senatorial] = await Promise.all([
        loadProvinces(),
        loadProvinceLabels(),
        loadProvinceChanges().catch(() => []),
        import('@/data/dare/senatorial-provinces.json')
          .then((m) => m.default as FeatureCollection)
          .catch(() => null),
      ])
      return {
        data,
        extra: {
          provinceLabels: labels,
          provinceChanges: changes,
          senatorialProvincesData: senatorial,
        },
      }
    })(set, get),

  toggleFortifications: () =>
    makeToggle('showFortifications', 'fortificationsData', 'fortificationsLoading', async () => {
      const { loadFortifications } = await import('@/data/dare')
      return { data: await loadFortifications() }
    })(set, get),

  toggleWater: () =>
    makeToggle('showWater', 'waterData', 'waterLoading', async () => {
      const { loadWater } = await import('@/data/dare')
      return { data: await loadWater() }
    })(set, get),

  toggleItinereRoads: () =>
    makeToggle('showItinereRoads', 'itinereRoadsData', 'itinereRoadsLoading', async () => {
      const { loadItinereRoads } = await import('@/data/itinere')
      return { data: await loadItinereRoads() }
    })(set, get),

  toggleBattles: () =>
    makeToggle('showBattles', 'battlesData', 'battlesLoading', async () => {
      const { loadBattles } = await import('@/data/unified')
      return { data: await loadBattles() }
    })(set, get),

  toggleEmperors: () =>
    makeToggle('showEmperors', 'emperorsData', 'emperorsLoading', async () => {
      const { loadEmperors } = await import('@/data/emperors')
      return { data: await loadEmperors() }
    })(set, get),

  toggleLegions: () =>
    makeToggle('showLegions', 'legionsData', 'legionsLoading', async () => {
      const { loadLegions } = await import('@/data/legions')
      return { data: await loadLegions() }
    })(set, get),

  toggleAqueducts: () =>
    makeToggle('showAqueducts', 'aqueductLinesData', 'aqueductsLoading', async () => {
      const lines = await import('@/data/awmc-aqueducts-temporal.json')
        .then((m) => m.default as FeatureCollection)
        .catch(() => null)
      return { data: lines }
    })(set, get),

  toggleTradeNetwork: () =>
    makeToggle('showTradeNetwork', 'tradeNetworkData', 'tradeNetworkLoading', async () => {
      const { loadTradeNetwork } = await import('@/data/trade')
      return { data: await loadTradeNetwork() }
    })(set, get),

  toggleEpigraphy: () =>
    makeToggle('showEpigraphy', 'epigraphyData', 'epigraphyLoading', async () => {
      const { loadEpigraphy } = await import('@/data/epigraphy')
      return { data: await loadEpigraphy() }
    })(set, get),

  toggleNotablePeople: () =>
    makeToggle('showNotablePeople', 'notablePeopleData', 'notablePeopleLoading', async () => {
      const { loadNotablePeople } = await import('@/data/people-layer')
      return { data: await loadNotablePeople() }
    })(set, get),

  toggleDataset: async (id: string) => {
    const ds = get().datasetState[id]
    if (!ds) return

    if (ds.show) {
      set({
        datasetState: { ...get().datasetState, [id]: { ...ds, show: false } },
        activePreset: 'custom',
      })
      return
    }
    if (ds.data != null) {
      set({
        datasetState: { ...get().datasetState, [id]: { ...ds, show: true } },
        activePreset: 'custom',
      })
      return
    }
    if (ds.loading) return

    set({ activePreset: 'custom' })
    await loadDatasetInto(set, get, id, true)
  },

  toggleSettlementType: (type: number) => {
    const { settlementTypes } = get()
    set({ settlementTypes: { ...settlementTypes, [type]: !settlementTypes[type] } })
  },

  toggleCategory: (category: SettlementCategory) => {
    const { hiddenCategories } = get()
    const next = new Set(hiddenCategories)
    if (next.has(category)) next.delete(category)
    else next.add(category)
    set({ hiddenCategories: next })
  },

  // --- Preset activation ---
  activatePreset: (preset: PresetName) => {
    if (preset === 'custom') {
      set({ activePreset: 'custom' })
      return
    }

    const def = PRESETS[preset]
    if (!def) return

    // Jump timeline to the preset's most interesting year
    if (def.timelineYear != null) {
      useTimelineStore.getState().setYear(def.timelineYear)
    }
    if (def.autoplay) {
      const t = useTimelineStore.getState()
      // normalize to 1x: the full 753 BC → 1453 arc runs ~44s — a watchable
      // time-lapse; a leftover 4x from earlier play would blink past it
      t.setSpeed(1)
      t.play()
    }
    if (def.view) {
      useMapNavStore.getState().flyTo(def.view.lat, def.view.lng, def.view.zoom)
    }

    // Turn off all layers, then turn on preset layers
    const update: Record<string, unknown> = { activePreset: preset }
    for (const key of ALL_LAYER_KEYS) {
      update[key] = def.layers.includes(key)
    }
    // Also handle dataset keys
    const dsUpdate = { ...get().datasetState }
    for (const ds of DATASET_REGISTRY) {
      const dsKey = `showDataset:${ds.id}`
      if (dsUpdate[ds.id]) {
        dsUpdate[ds.id] = { ...dsUpdate[ds.id], show: def.layers.includes(dsKey) }
      }
    }
    update.datasetState = dsUpdate
    set(update as Partial<MapLayerState>)

    const promises: Promise<void>[] = []
    for (const layerKey of def.layers) {
      if (layerKey.startsWith('showDataset:')) {
        const dsId = layerKey.slice('showDataset:'.length)
        const ds = get().datasetState[dsId]
        if (ds && !ds.data && !ds.loading) {
          promises.push(loadDatasetInto(set, get, dsId, true))
        }
      } else {
        const load = LAYER_LOADERS[layerKey]
        if (load) promises.push(load(set, get))
      }
    }
    Promise.all(promises).catch((err) => console.error('Failed to load preset layers:', err))
  },

  setLayers: (keys: string[]) => {
    const update: Record<string, unknown> = { activePreset: 'custom' }
    for (const key of ALL_LAYER_KEYS) {
      update[key] = keys.includes(key)
    }
    const dsUpdate = { ...get().datasetState }
    for (const ds of DATASET_REGISTRY) {
      const dsKey = `showDataset:${ds.id}`
      if (dsUpdate[ds.id]) {
        dsUpdate[ds.id] = { ...dsUpdate[ds.id], show: keys.includes(dsKey) }
      }
    }
    update.datasetState = dsUpdate
    set(update as Partial<MapLayerState>)

    const promises: Promise<void>[] = []
    for (const layerKey of keys) {
      if (layerKey.startsWith('showDataset:')) {
        const dsId = layerKey.slice('showDataset:'.length)
        const ds = get().datasetState[dsId]
        if (ds && !ds.data && !ds.loading) {
          promises.push(loadDatasetInto(set, get, dsId, true))
        }
      } else {
        const load = LAYER_LOADERS[layerKey]
        if (load) promises.push(load(set, get))
      }
    }
    Promise.all(promises).catch((err) => console.error('Failed to load story layers:', err))
  },
}))

// --- Layer-selection persistence -------------------------------------------
// The chosen layer set survives a refresh (Dominik's ask): every toggle
// change writes the active show* keys to localStorage; MapView restores
// them on a fresh load via setLayers (which also lazy-loads their data).
const LAYERS_STORAGE_KEY = 'atlas-layers-v1'

export function getPersistedLayers(): string[] | null {
  try {
    const raw = localStorage.getItem(LAYERS_STORAGE_KEY)
    if (!raw) return null
    const arr = JSON.parse(raw)
    const validDataset = new Set(DATASET_REGISTRY.map((d) => `showDataset:${d.id}`))
    return Array.isArray(arr)
      ? arr.filter((k) => ALL_LAYER_KEYS.includes(k) || validDataset.has(k))
      : null
  } catch {
    return null
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null
useMapLayerStore.subscribe((state) => {
  if (persistTimer) return
  persistTimer = setTimeout(() => {
    persistTimer = null
    try {
      const active: string[] = ALL_LAYER_KEYS.filter(
        (k) => (state as unknown as Record<string, unknown>)[k] === true,
      )
      // dataset toggles are layers too — without these, refresh silently
      // dropped shipwrecks/temples/villas from a saved view
      for (const [id, ds] of Object.entries(state.datasetState)) {
        if (ds?.show) active.push(`showDataset:${id}`)
      }
      localStorage.setItem(LAYERS_STORAGE_KEY, JSON.stringify(active))
    } catch {
      /* storage unavailable (private mode) — persistence is best-effort */
    }
  }, 500)
})
