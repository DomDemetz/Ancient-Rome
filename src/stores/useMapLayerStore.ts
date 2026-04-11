import { create } from 'zustand'
import { useTimelineStore } from '@/stores/useTimelineStore'
import type { FeatureCollection } from 'geojson'
import type { DareSettlement, ProvinceLabel, CityPopulation, ProvinceChange } from '@/data/dare'
import type { PresenceGrid } from '@/features/map/layers/PresenceLayer'
import type { SettlementCategory } from '@/features/map/layers/settlementStyles'
import type { Battle } from '@/data/battles'
import type { Amphitheater } from '@/data/amphitheaters'
import type { Emperor } from '@/data/emperors'
import type { Legion } from '@/data/legions'
import type { Shipwreck } from '@/data/shipwrecks'
import type { Mine } from '@/data/mines'
import type { Aqueduct } from '@/data/aqueducts'
import type { ReligiousSite } from '@/data/religion'
import type { Building } from '@/data/buildings'
import type { Press } from '@/data/presses'
import type { TradeNetwork } from '@/data/trade'
import type { EpigraphyCluster } from '@/data/epigraphy'
import type { NotablePerson } from '@/data/people-layer'

// --- Preset definitions ---
export type PresetName = 'conquest' | 'economy' | 'gods' | 'riseAndFall' | 'engineering' | 'custom'

export interface PresetDef {
  label: string
  description: string
  layers: string[]
  timelineYear?: number
}

export const PRESETS: Record<Exclude<PresetName, 'custom'>, PresetDef> = {
  conquest: {
    label: 'The Conquest',
    description: 'Watch Rome conquer the Mediterranean',
    timelineYear: -200,
    layers: ['showBattles', 'showLegions', 'showLimes', 'showFortifications', 'showPresence'],
  },
  economy: {
    label: 'The Economy',
    description: 'The commercial engine of empire',
    timelineYear: 100,
    layers: [
      'showRoads',
      'showItinereRoads',
      'showSettlements',
      'showShipwrecks',
      'showMines',
      'showPresses',
      'showTradeNetwork',
      'showAmphitheaters',
    ],
  },
  gods: {
    label: 'Gods & Temples',
    description: 'From Jupiter to Christ — religious transformation',
    timelineYear: 200,
    layers: ['showReligion', 'showBuildings', 'showSettlements', 'showProvinces', 'showEpigraphy'],
  },
  riseAndFall: {
    label: 'Rise & Fall',
    description: 'The full puzzle assembled — scrub 753 BC to 476 AD',
    timelineYear: -753,
    layers: [
      'showBattles',
      'showLegions',
      'showEmperors',
      'showRoads',
      'showSettlements',
      'showProvinces',
      'showLimes',
      'showFortifications',
      'showAmphitheaters',
      'showShipwrecks',
      'showReligion',
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
      'showAmphitheaters',
      'showBuildings',
      'showAqueducts',
      'showWater',
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
        key: 'Territories',
        label: 'Territories',
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
        key: 'Settlements',
        label: 'Settlements',
        activeClass: 'bg-yellow-900/80 border-yellow-700 text-yellow-100 hover:bg-yellow-800/80',
      },
      {
        key: 'Amphitheaters',
        label: 'Amphitheaters',
        activeClass: 'bg-amber-800/80 border-amber-600 text-amber-100 hover:bg-amber-700/80',
      },
      {
        key: 'Buildings',
        label: 'Buildings',
        activeClass: 'bg-yellow-800/80 border-yellow-600 text-yellow-100 hover:bg-yellow-700/80',
      },
      {
        key: 'Epigraphy',
        label: 'Epigraphy',
        activeClass: 'bg-yellow-900/80 border-yellow-700 text-yellow-100 hover:bg-yellow-800/80',
      },
      {
        key: 'Vici',
        label: 'All Sites (85K)',
        activeClass:
          'bg-emerald-900/80 border-emerald-700 text-emerald-100 hover:bg-emerald-800/80',
      },
      {
        key: 'NotablePeople',
        label: 'Notable People (2.4K)',
        activeClass: 'bg-indigo-900/80 border-indigo-700 text-indigo-100 hover:bg-indigo-800/80',
      },
    ],
  },
  {
    label: 'Economy',
    layers: [
      {
        key: 'Ports',
        label: 'Ports & Harbours',
        activeClass: 'bg-blue-900/80 border-blue-600 text-blue-100 hover:bg-blue-800/80',
      },
      {
        key: 'TradeNetwork',
        label: 'Trade Network',
        activeClass: 'bg-teal-900/80 border-teal-700 text-teal-100 hover:bg-teal-800/80',
      },
      {
        key: 'Shipwrecks',
        label: 'Shipwrecks',
        activeClass: 'bg-cyan-900/80 border-cyan-700 text-cyan-100 hover:bg-cyan-800/80',
      },
      {
        key: 'Mines',
        label: 'Mines & Quarries',
        activeClass: 'bg-stone-800/80 border-stone-600 text-stone-100 hover:bg-stone-700/80',
      },
      {
        key: 'Presses',
        label: 'Oil & Wine Presses',
        activeClass: 'bg-yellow-950/80 border-yellow-800 text-yellow-200 hover:bg-yellow-900/80',
      },
    ],
  },
  {
    label: 'Religion',
    layers: [
      {
        key: 'Religion',
        label: 'Religious Sites',
        activeClass: 'bg-violet-900/80 border-violet-700 text-violet-100 hover:bg-violet-800/80',
      },
    ],
  },
  {
    label: 'Infrastructure',
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
      {
        key: 'Aqueducts',
        label: 'Aqueducts',
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

// --- All toggleable layer keys ---
export const ALL_LAYER_KEYS = [
  'showRoads',
  'showSettlements',
  'showLimes',
  'showPresence',
  'showProvinces',
  'showFortifications',
  'showWater',
  'showItinereRoads',
  'showBattles',
  'showAmphitheaters',
  'showEmperors',
  'showLegions',
  'showShipwrecks',
  'showMines',
  'showAqueducts',
  'showReligion',
  'showBuildings',
  'showPresses',
  'showTradeNetwork',
  'showEpigraphy',
  'showVici',
  'showPorts',
  'showNotablePeople',
] as const

interface PortData {
  id: string
  name: string
  lat: number
  lng: number
  portType?: string
  description?: string
  startYear?: number
  endYear?: number
  source?: string
}

interface MapLayerState {
  // Existing layers
  showRoads: boolean
  showSettlements: boolean
  showLimes: boolean
  showPresence: boolean
  showProvinces: boolean
  showFortifications: boolean
  showWater: boolean
  showItinereRoads: boolean
  roadsData: FeatureCollection | null
  settlementsData: DareSettlement[] | null
  cityPopulationsData: CityPopulation[] | null
  limesData: FeatureCollection | null
  presenceData: PresenceGrid | null
  provincesData: FeatureCollection | null
  provinceLabels: ProvinceLabel[] | null
  provinceChanges: ProvinceChange[] | null
  fortificationsData: FeatureCollection | null
  waterData: FeatureCollection | null
  itinereRoadsData: FeatureCollection | null
  roadsLoading: boolean
  settlementsLoading: boolean
  limesLoading: boolean
  presenceLoading: boolean
  provincesLoading: boolean
  fortificationsLoading: boolean
  waterLoading: boolean
  itinereRoadsLoading: boolean

  // Wave 1 layers
  showBattles: boolean
  battlesData: Battle[] | null
  battlesLoading: boolean
  showAmphitheaters: boolean
  amphitheatersData: Amphitheater[] | null
  amphitheatersLoading: boolean
  showEmperors: boolean
  emperorsData: Emperor[] | null
  emperorsLoading: boolean

  // Wave 2 layers
  showLegions: boolean
  legionsData: Legion[] | null
  legionsLoading: boolean
  showShipwrecks: boolean
  shipwrecksData: Shipwreck[] | null
  shipwrecksLoading: boolean
  showMines: boolean
  minesData: Mine[] | null
  minesLoading: boolean
  showAqueducts: boolean
  aqueductsData: Aqueduct[] | null
  aqueductLinesData: FeatureCollection | null
  aqueductsLoading: boolean
  senatorialProvincesData: FeatureCollection | null

  // Wave 3 layers
  showReligion: boolean
  religionData: ReligiousSite[] | null
  religionLoading: boolean
  showBuildings: boolean
  buildingsData: Building[] | null
  buildingsLoading: boolean
  showPresses: boolean
  pressesData: Press[] | null
  pressesLoading: boolean
  showTradeNetwork: boolean
  tradeNetworkData: TradeNetwork | null
  tradeNetworkLoading: boolean
  showEpigraphy: boolean
  epigraphyData: EpigraphyCluster[] | null
  epigraphyLoading: boolean
  showVici: boolean
  viciData: unknown[] | null
  viciLoading: boolean
  showPorts: boolean
  portsData: PortData[] | null
  portsLoading: boolean
  showNotablePeople: boolean
  notablePeopleData: NotablePerson[] | null
  notablePeopleLoading: boolean

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
  toggleLimes: () => void
  togglePresence: () => void
  toggleProvinces: () => void
  toggleFortifications: () => void
  toggleWater: () => void
  toggleItinereRoads: () => void
  toggleSettlementType: (type: number) => void
  toggleCategory: (category: SettlementCategory) => void
  toggleBattles: () => void
  toggleAmphitheaters: () => void
  toggleEmperors: () => void
  toggleLegions: () => void
  toggleShipwrecks: () => void
  toggleMines: () => void
  toggleAqueducts: () => void
  toggleReligion: () => void
  toggleBuildings: () => void
  togglePresses: () => void
  toggleTradeNetwork: () => void
  toggleEpigraphy: () => void
  toggleVici: () => void
  togglePorts: () => void
  toggleNotablePeople: () => void
  activatePreset: (preset: PresetName) => void
  dismissError: () => void
}

const ALL_SETTLEMENT_TYPES = [
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 24, 31, 32, 34, 35, 43, 46, 47, 49, 50, 51, 52, 53, 55,
  57, 58, 61, 63, 64, 66, 76,
] as const
const ENABLED_BY_DEFAULT = new Set([11, 12, 13, 14, 16, 17, 18, 31, 35])
const defaultSettlementTypes: Record<number, boolean> = Object.fromEntries(
  ALL_SETTLEMENT_TYPES.map((t) => [t, ENABLED_BY_DEFAULT.has(t)]),
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

export const useMapLayerStore = create<MapLayerState & MapLayerActions>((set, get) => ({
  // --- Initial state ---
  showRoads: false,
  roadsData: null,
  roadsLoading: false,
  showSettlements: false,
  settlementsData: null,
  cityPopulationsData: null,
  settlementsLoading: false,
  showLimes: false,
  limesData: null,
  limesLoading: false,
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
  showAmphitheaters: false,
  amphitheatersData: null,
  amphitheatersLoading: false,
  showEmperors: false,
  emperorsData: null,
  emperorsLoading: false,
  showLegions: false,
  legionsData: null,
  legionsLoading: false,
  showShipwrecks: false,
  shipwrecksData: null,
  shipwrecksLoading: false,
  showMines: false,
  minesData: null,
  minesLoading: false,
  showAqueducts: false,
  aqueductsData: null,
  aqueductLinesData: null,
  aqueductsLoading: false,
  senatorialProvincesData: null,
  showReligion: false,
  religionData: null,
  religionLoading: false,
  showBuildings: false,
  buildingsData: null,
  buildingsLoading: false,
  showPresses: false,
  pressesData: null,
  pressesLoading: false,
  showTradeNetwork: false,
  tradeNetworkData: null,
  tradeNetworkLoading: false,
  showEpigraphy: false,
  epigraphyData: null,
  epigraphyLoading: false,
  showVici: false,
  viciData: null,
  viciLoading: false,
  showPorts: false,
  portsData: null,
  portsLoading: false,
  showNotablePeople: false,
  notablePeopleData: null,
  notablePeopleLoading: false,
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
    makeToggle('showSettlements', 'settlementsData', 'settlementsLoading', async () => {
      const { loadSettlements, loadCityPopulations } = await import('@/data/dare')
      const [data, pops] = await Promise.all([
        loadSettlements(),
        loadCityPopulations().catch(() => []),
      ])
      return { data, extra: { cityPopulationsData: pops } }
    })(set, get),

  toggleLimes: () =>
    makeToggle('showLimes', 'limesData', 'limesLoading', async () => {
      const { loadLimes } = await import('@/data/dare')
      return { data: await loadLimes() }
    })(set, get),

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
      const { loadBattles } = await import('@/data/battles')
      return { data: await loadBattles() }
    })(set, get),

  toggleAmphitheaters: () =>
    makeToggle('showAmphitheaters', 'amphitheatersData', 'amphitheatersLoading', async () => {
      const { loadAmphitheaters } = await import('@/data/amphitheaters')
      return { data: await loadAmphitheaters() }
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

  toggleShipwrecks: () =>
    makeToggle('showShipwrecks', 'shipwrecksData', 'shipwrecksLoading', async () => {
      const { loadShipwrecks } = await import('@/data/shipwrecks')
      return { data: await loadShipwrecks() }
    })(set, get),

  toggleMines: () =>
    makeToggle('showMines', 'minesData', 'minesLoading', async () => {
      const { loadMines } = await import('@/data/mines')
      return { data: await loadMines() }
    })(set, get),

  toggleAqueducts: () =>
    makeToggle('showAqueducts', 'aqueductsData', 'aqueductsLoading', async () => {
      const { loadAqueducts } = await import('@/data/aqueducts')
      const [data, lines] = await Promise.all([
        loadAqueducts(),
        import('@/data/awmc-aqueducts-temporal.json')
          .then((m) => m.default as FeatureCollection)
          .catch(() => null),
      ])
      return { data, extra: { aqueductLinesData: lines } }
    })(set, get),

  toggleReligion: () =>
    makeToggle('showReligion', 'religionData', 'religionLoading', async () => {
      const { loadReligion } = await import('@/data/religion')
      return { data: await loadReligion() }
    })(set, get),

  toggleBuildings: () =>
    makeToggle('showBuildings', 'buildingsData', 'buildingsLoading', async () => {
      const { loadBuildings } = await import('@/data/buildings')
      return { data: await loadBuildings() }
    })(set, get),

  togglePresses: () =>
    makeToggle('showPresses', 'pressesData', 'pressesLoading', async () => {
      const { loadPresses } = await import('@/data/presses')
      return { data: await loadPresses() }
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

  toggleVici: () =>
    makeToggle('showVici', 'viciData', 'viciLoading', async () => {
      const data = await import('@/data/vici-sites.json')
      return { data: data.default }
    })(set, get),

  togglePorts: () =>
    makeToggle('showPorts', 'portsData', 'portsLoading', async () => {
      const data = await import('@/data/ancient-ports.json')
      return { data: data.default }
    })(set, get),

  toggleNotablePeople: () =>
    makeToggle('showNotablePeople', 'notablePeopleData', 'notablePeopleLoading', async () => {
      const { loadNotablePeople } = await import('@/data/people-layer')
      return { data: await loadNotablePeople() }
    })(set, get),

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

    // Turn off all layers, then turn on preset layers
    const update: Record<string, unknown> = { activePreset: preset }
    for (const key of ALL_LAYER_KEYS) {
      update[key] = def.layers.includes(key)
    }
    set(update as Partial<MapLayerState>)

    // Compact loader registry: maps showKey to an ensureLoaded call
    const loaders: Record<string, (set: StoreSet, get: StoreGet) => Promise<void>> = {
      showRoads: ensureLoaded('roadsData', 'roadsLoading', async () => {
        const { loadRoads } = await import('@/data/dare')
        return { roadsData: await loadRoads() }
      }),
      showSettlements: ensureLoaded('settlementsData', 'settlementsLoading', async () => {
        const { loadSettlements, loadCityPopulations } = await import('@/data/dare')
        const [data, pops] = await Promise.all([
          loadSettlements(),
          loadCityPopulations().catch(() => []),
        ])
        return { settlementsData: data, cityPopulationsData: pops }
      }),
      showLimes: ensureLoaded('limesData', 'limesLoading', async () => {
        const { loadLimes } = await import('@/data/dare')
        return { limesData: await loadLimes() }
      }),
      showPresence: ensureLoaded('presenceData', 'presenceLoading', async () => {
        const { loadPresenceGrid } = await import('@/data/dare')
        return { presenceData: await loadPresenceGrid() }
      }),
      showProvinces: ensureLoaded('provincesData', 'provincesLoading', async () => {
        const { loadProvinces, loadProvinceLabels, loadProvinceChanges } =
          await import('@/data/dare')
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
        const { loadBattles } = await import('@/data/battles')
        return { battlesData: await loadBattles() }
      }),
      showAmphitheaters: ensureLoaded('amphitheatersData', 'amphitheatersLoading', async () => {
        const { loadAmphitheaters } = await import('@/data/amphitheaters')
        return { amphitheatersData: await loadAmphitheaters() }
      }),
      showEmperors: ensureLoaded('emperorsData', 'emperorsLoading', async () => {
        const { loadEmperors } = await import('@/data/emperors')
        return { emperorsData: await loadEmperors() }
      }),
      showLegions: ensureLoaded('legionsData', 'legionsLoading', async () => {
        const { loadLegions } = await import('@/data/legions')
        return { legionsData: await loadLegions() }
      }),
      showShipwrecks: ensureLoaded('shipwrecksData', 'shipwrecksLoading', async () => {
        const { loadShipwrecks } = await import('@/data/shipwrecks')
        return { shipwrecksData: await loadShipwrecks() }
      }),
      showMines: ensureLoaded('minesData', 'minesLoading', async () => {
        const { loadMines } = await import('@/data/mines')
        return { minesData: await loadMines() }
      }),
      showAqueducts: ensureLoaded('aqueductsData', 'aqueductsLoading', async () => {
        const { loadAqueducts } = await import('@/data/aqueducts')
        const [data, lines] = await Promise.all([
          loadAqueducts(),
          import('@/data/awmc-aqueducts-temporal.json')
            .then((m) => m.default as FeatureCollection)
            .catch(() => null),
        ])
        return { aqueductsData: data, aqueductLinesData: lines }
      }),
      showReligion: ensureLoaded('religionData', 'religionLoading', async () => {
        const { loadReligion } = await import('@/data/religion')
        return { religionData: await loadReligion() }
      }),
      showBuildings: ensureLoaded('buildingsData', 'buildingsLoading', async () => {
        const { loadBuildings } = await import('@/data/buildings')
        return { buildingsData: await loadBuildings() }
      }),
      showPresses: ensureLoaded('pressesData', 'pressesLoading', async () => {
        const { loadPresses } = await import('@/data/presses')
        return { pressesData: await loadPresses() }
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

    const promises: Promise<void>[] = []
    for (const layerKey of def.layers) {
      const load = loaders[layerKey]
      if (load) promises.push(load(set, get))
    }
    Promise.all(promises).catch((err) => console.error('Failed to load preset layers:', err))
  },
}))
