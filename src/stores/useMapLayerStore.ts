import { create } from 'zustand'
import type { FeatureCollection } from 'geojson'
import type { DareSettlement, ProvinceLabel, CityPopulation, ProvinceChange } from '@/data/dare'
import type { PresenceGrid } from '@/features/map/PresenceLayer'
import type { SettlementCategory } from '@/features/map/settlementStyles'
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

// --- Preset definitions ---
export type PresetName = 'conquest' | 'economy' | 'gods' | 'riseAndFall' | 'engineering' | 'custom'

export interface PresetDef {
  label: string
  description: string
  layers: string[]
}

export const PRESETS: Record<Exclude<PresetName, 'custom'>, PresetDef> = {
  conquest: {
    label: 'The Conquest',
    description: 'Watch Rome conquer the Mediterranean',
    layers: [
      'showTerritories',
      'showBattles',
      'showLegions',
      'showLimes',
      'showFortifications',
      'showPresence',
    ],
  },
  economy: {
    label: 'The Economy',
    description: 'The commercial engine of empire',
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
    layers: ['showReligion', 'showBuildings', 'showSettlements', 'showProvinces', 'showEpigraphy'],
  },
  riseAndFall: {
    label: 'Rise & Fall',
    description: 'The full puzzle assembled — scrub 753 BC to 476 AD',
    layers: [
      'showTerritories',
      'showBattles',
      'showLegions',
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
const ALL_LAYER_KEYS = [
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
] as const

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
  aqueductsLoading: boolean

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
  portsData: unknown[] | null
  portsLoading: boolean

  // Settlement filtering
  settlementTypes: Record<number, boolean>
  hiddenCategories: Set<string>

  // Presets
  activePreset: PresetName
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
  activatePreset: (preset: PresetName) => void
}

const ALL_SETTLEMENT_TYPES = [
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 24, 31, 32, 34, 35, 43, 46, 47, 49, 50, 51, 52, 53, 55,
  57, 58, 61, 63, 64, 66, 76,
] as const
const ENABLED_BY_DEFAULT = new Set([11, 12, 13, 14, 16, 17, 18, 31, 35])
const defaultSettlementTypes: Record<number, boolean> = Object.fromEntries(
  ALL_SETTLEMENT_TYPES.map((t) => [t, ENABLED_BY_DEFAULT.has(t)]),
)

// Helper to create a standard lazy-loading toggle
function makeToggle<K extends string>(
  showKey: K,
  dataKey: string,
  loadingKey: string,
  loader: () => Promise<{ data: unknown; extra?: Record<string, unknown> }>,
) {
  return async (set: (s: Partial<MapLayerState>) => void, get: () => MapLayerState) => {
    const state = get()
    const show = (state as unknown as Record<string, unknown>)[showKey] as boolean
    const data = (state as unknown as Record<string, unknown>)[dataKey]
    const loading = (state as unknown as Record<string, unknown>)[loadingKey] as boolean

    if (show) {
      set({ [showKey]: false, activePreset: 'custom' } as Partial<MapLayerState>)
      return
    }
    if (data) {
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
      console.error(`Failed to load ${showKey}:`, err)
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
  aqueductsLoading: false,
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
  settlementTypes: { ...defaultSettlementTypes },
  hiddenCategories: new Set<string>(),
  activePreset: 'custom',

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
      const [data, labels, changes] = await Promise.all([
        loadProvinces(),
        loadProvinceLabels(),
        loadProvinceChanges().catch(() => []),
      ])
      return { data, extra: { provinceLabels: labels, provinceChanges: changes } }
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
      return { data: await loadAqueducts() }
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

    // Turn off all layers, then turn on preset layers
    const update: Record<string, unknown> = { activePreset: preset }
    for (const key of ALL_LAYER_KEYS) {
      update[key] = def.layers.includes(key)
    }
    set(update as Partial<MapLayerState>)

    // Loader registry: maps showKey to { dataKey, loadingKey, loader }
    const loaders: Record<
      string,
      { dataKey: string; loadingKey: string; load: () => Promise<void> }
    > = {
      showRoads: {
        dataKey: 'roadsData',
        loadingKey: 'roadsLoading',
        load: async () => {
          set({ roadsLoading: true })
          const { loadRoads } = await import('@/data/dare')
          set({ roadsData: await loadRoads(), roadsLoading: false })
        },
      },
      showSettlements: {
        dataKey: 'settlementsData',
        loadingKey: 'settlementsLoading',
        load: async () => {
          set({ settlementsLoading: true })
          const { loadSettlements, loadCityPopulations } = await import('@/data/dare')
          const [data, pops] = await Promise.all([
            loadSettlements(),
            loadCityPopulations().catch(() => []),
          ])
          set({ settlementsData: data, cityPopulationsData: pops, settlementsLoading: false })
        },
      },
      showLimes: {
        dataKey: 'limesData',
        loadingKey: 'limesLoading',
        load: async () => {
          set({ limesLoading: true })
          const { loadLimes } = await import('@/data/dare')
          set({ limesData: await loadLimes(), limesLoading: false })
        },
      },
      showPresence: {
        dataKey: 'presenceData',
        loadingKey: 'presenceLoading',
        load: async () => {
          set({ presenceLoading: true })
          const { loadPresenceGrid } = await import('@/data/dare')
          set({ presenceData: await loadPresenceGrid(), presenceLoading: false })
        },
      },
      showProvinces: {
        dataKey: 'provincesData',
        loadingKey: 'provincesLoading',
        load: async () => {
          set({ provincesLoading: true })
          const { loadProvinces, loadProvinceLabels, loadProvinceChanges } =
            await import('@/data/dare')
          const [d, l, c] = await Promise.all([
            loadProvinces(),
            loadProvinceLabels(),
            loadProvinceChanges().catch(() => []),
          ])
          set({ provincesData: d, provinceLabels: l, provinceChanges: c, provincesLoading: false })
        },
      },
      showFortifications: {
        dataKey: 'fortificationsData',
        loadingKey: 'fortificationsLoading',
        load: async () => {
          set({ fortificationsLoading: true })
          const { loadFortifications } = await import('@/data/dare')
          set({ fortificationsData: await loadFortifications(), fortificationsLoading: false })
        },
      },
      showWater: {
        dataKey: 'waterData',
        loadingKey: 'waterLoading',
        load: async () => {
          set({ waterLoading: true })
          const { loadWater } = await import('@/data/dare')
          set({ waterData: await loadWater(), waterLoading: false })
        },
      },
      showItinereRoads: {
        dataKey: 'itinereRoadsData',
        loadingKey: 'itinereRoadsLoading',
        load: async () => {
          set({ itinereRoadsLoading: true })
          const { loadItinereRoads } = await import('@/data/itinere')
          set({ itinereRoadsData: await loadItinereRoads(), itinereRoadsLoading: false })
        },
      },
      showBattles: {
        dataKey: 'battlesData',
        loadingKey: 'battlesLoading',
        load: async () => {
          set({ battlesLoading: true })
          const { loadBattles } = await import('@/data/battles')
          set({ battlesData: await loadBattles(), battlesLoading: false })
        },
      },
      showAmphitheaters: {
        dataKey: 'amphitheatersData',
        loadingKey: 'amphitheatersLoading',
        load: async () => {
          set({ amphitheatersLoading: true })
          const { loadAmphitheaters } = await import('@/data/amphitheaters')
          set({ amphitheatersData: await loadAmphitheaters(), amphitheatersLoading: false })
        },
      },
      showLegions: {
        dataKey: 'legionsData',
        loadingKey: 'legionsLoading',
        load: async () => {
          set({ legionsLoading: true })
          const { loadLegions } = await import('@/data/legions')
          set({ legionsData: await loadLegions(), legionsLoading: false })
        },
      },
      showShipwrecks: {
        dataKey: 'shipwrecksData',
        loadingKey: 'shipwrecksLoading',
        load: async () => {
          set({ shipwrecksLoading: true })
          const { loadShipwrecks } = await import('@/data/shipwrecks')
          set({ shipwrecksData: await loadShipwrecks(), shipwrecksLoading: false })
        },
      },
      showMines: {
        dataKey: 'minesData',
        loadingKey: 'minesLoading',
        load: async () => {
          set({ minesLoading: true })
          const { loadMines } = await import('@/data/mines')
          set({ minesData: await loadMines(), minesLoading: false })
        },
      },
      showAqueducts: {
        dataKey: 'aqueductsData',
        loadingKey: 'aqueductsLoading',
        load: async () => {
          set({ aqueductsLoading: true })
          const { loadAqueducts } = await import('@/data/aqueducts')
          set({ aqueductsData: await loadAqueducts(), aqueductsLoading: false })
        },
      },
      showReligion: {
        dataKey: 'religionData',
        loadingKey: 'religionLoading',
        load: async () => {
          set({ religionLoading: true })
          const { loadReligion } = await import('@/data/religion')
          set({ religionData: await loadReligion(), religionLoading: false })
        },
      },
      showBuildings: {
        dataKey: 'buildingsData',
        loadingKey: 'buildingsLoading',
        load: async () => {
          set({ buildingsLoading: true })
          const { loadBuildings } = await import('@/data/buildings')
          set({ buildingsData: await loadBuildings(), buildingsLoading: false })
        },
      },
      showPresses: {
        dataKey: 'pressesData',
        loadingKey: 'pressesLoading',
        load: async () => {
          set({ pressesLoading: true })
          const { loadPresses } = await import('@/data/presses')
          set({ pressesData: await loadPresses(), pressesLoading: false })
        },
      },
      showTradeNetwork: {
        dataKey: 'tradeNetworkData',
        loadingKey: 'tradeNetworkLoading',
        load: async () => {
          set({ tradeNetworkLoading: true })
          const { loadTradeNetwork } = await import('@/data/trade')
          set({ tradeNetworkData: await loadTradeNetwork(), tradeNetworkLoading: false })
        },
      },
      showEpigraphy: {
        dataKey: 'epigraphyData',
        loadingKey: 'epigraphyLoading',
        load: async () => {
          set({ epigraphyLoading: true })
          const { loadEpigraphy } = await import('@/data/epigraphy')
          set({ epigraphyData: await loadEpigraphy(), epigraphyLoading: false })
        },
      },
    }

    const afterState = get()
    const promises: Promise<void>[] = []
    for (const layerKey of def.layers) {
      const reg = loaders[layerKey]
      if (!reg) continue
      const s = afterState as unknown as Record<string, unknown>
      if (!s[reg.dataKey] && !s[reg.loadingKey]) {
        promises.push(reg.load())
      }
    }
    Promise.all(promises).catch((err) => console.error('Failed to load preset layers:', err))
  },
}))
