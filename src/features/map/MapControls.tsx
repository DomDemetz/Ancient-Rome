import { useMemo, useState } from 'react'
import {
  Layers,
  X,
  ChevronDown,
  ChevronRight,
  Globe,
  Route,
  Swords,
  Coins,
  Landmark,
  MapPin,
} from 'lucide-react'
import { useMapLayerStore, PRESETS, LAYER_GROUPS } from '@/stores/useMapLayerStore'
import type { PresetName } from '@/stores/useMapLayerStore'
import { DARE_TYPE_LABELS, CATEGORY_STYLES, DARE_TYPE_TO_CATEGORY } from './settlementStyles'
import { useUIStore } from '@/stores/useUIStore'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/ui/drawer'
import { ScrollArea } from '@/ui/scroll-area'

const GROUP_ICONS: Record<string, typeof Globe> = {
  Political: Globe,
  Military: Swords,
  Urban: Landmark,
  Economy: Coins,
  Religion: Landmark,
  Infrastructure: Route,
  Points: MapPin,
}

interface MapControlsProps {
  showTerritories: boolean
  onToggleTerritories: () => void
}

interface LayerPanelContentProps {
  layerState: Record<string, { active: boolean; loading: boolean; toggle: () => void }>
  typeCounts: { type: number; label: string; count: number }[]
  collapsedGroups: Set<string>
  toggleGroup: (label: string) => void
  activePreset: PresetName
  activatePreset: (preset: PresetName) => void
  showSettlements: boolean
  settlementTypes: Record<number, boolean>
  toggleSettlementType: (type: number) => void
}

function LayerPanelContent({
  layerState,
  typeCounts,
  collapsedGroups,
  toggleGroup,
  activePreset,
  activatePreset,
  showSettlements,
  settlementTypes,
  toggleSettlementType,
}: LayerPanelContentProps) {
  const presets = Object.entries(PRESETS) as [
    Exclude<PresetName, 'custom'>,
    (typeof PRESETS)[keyof typeof PRESETS],
  ][]

  return (
    <div className="p-4 space-y-4">
      {/* Presets */}
      <div>
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
          Presets
        </p>
        <div className="flex flex-wrap gap-1.5">
          {presets.map(([key, preset]) => {
            const active = activePreset === key
            return (
              <button
                key={key}
                onClick={() => activatePreset(key)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-full transition-all',
                  active
                    ? 'bg-accent-gold text-black shadow-lg shadow-accent-gold/20'
                    : 'bg-bg-card text-text-secondary border border-border hover:bg-bg-secondary',
                )}
                title={preset.description}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Layer Groups */}
      {LAYER_GROUPS.map((group) => {
        const GroupIcon = GROUP_ICONS[group.label]
        const isCollapsed = collapsedGroups.has(group.label)
        const activeCount = group.layers.filter((l) => layerState[l.key]?.active).length

        return (
          <div key={group.label}>
            <button
              onClick={() => toggleGroup(group.label)}
              className="w-full flex items-center gap-2 py-1.5 text-xs font-semibold text-text-secondary uppercase tracking-wider hover:text-text-primary transition-colors"
            >
              {GroupIcon && <GroupIcon className="size-3.5" />}
              <span>{group.label}</span>
              {activeCount > 0 && (
                <span className="ml-1 text-accent-gold text-[10px]">{activeCount}</span>
              )}
              <span className="ml-auto">
                {isCollapsed ? (
                  <ChevronRight className="size-3.5" />
                ) : (
                  <ChevronDown className="size-3.5" />
                )}
              </span>
            </button>
            {!isCollapsed && (
              <div className="space-y-0.5 mt-1">
                {group.layers.map((layer) => {
                  const state = layerState[layer.key]
                  if (!state) return null
                  return (
                    <div key={layer.key}>
                      <button
                        onClick={state.toggle}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border transition-colors text-left',
                          state.loading
                            ? 'bg-bg-card/50 border-border text-text-secondary/40 cursor-wait'
                            : state.active
                              ? `${layer.activeClass} border-current/20`
                              : 'bg-bg-card/50 border-transparent text-text-secondary hover:bg-bg-secondary hover:text-text-primary',
                        )}
                        title={`Toggle ${layer.label.toLowerCase()} layer`}
                      >
                        {state.loading ? `${layer.label}...` : layer.label}
                      </button>

                      {/* Settlement type submenu */}
                      {layer.key === 'Settlements' && showSettlements && typeCounts.length > 0 && (
                        <div
                          className="rounded-lg border border-white/10 bg-bg-card/80 overflow-y-auto mt-1"
                          style={{ maxHeight: 180 }}
                        >
                          {typeCounts.map(({ type, label, count }) => {
                            const enabled = settlementTypes[type] !== false
                            const cat = DARE_TYPE_TO_CATEGORY[type]
                            const color = cat ? CATEGORY_STYLES[cat].color : '#95a5a6'
                            return (
                              <button
                                key={type}
                                onClick={() => toggleSettlementType(type)}
                                className={cn(
                                  'flex items-center gap-1.5 w-full px-2.5 py-1 text-[10px] text-left transition-colors hover:bg-white/10 rounded',
                                  enabled ? 'text-white/90' : 'text-white/30',
                                )}
                              >
                                <span
                                  className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: enabled ? color : '#666' }}
                                />
                                <span className="flex-1 truncate">{label}</span>
                                <span className="tabular-nums">{count}</span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function MapControls({ showTerritories, onToggleTerritories }: MapControlsProps) {
  const [panelOpen, setPanelOpen] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const isMobile = useUIStore((s) => s.isMobile)

  const store = useMapLayerStore()
  const {
    showRoads,
    showSettlements,
    showLimes,
    showPresence,
    showProvinces,
    showFortifications,
    showWater,
    showItinereRoads,
    showBattles,
    showAmphitheaters,
    showEmperors,
    showLegions,
    showShipwrecks,
    showMines,
    showAqueducts,
    showReligion,
    showBuildings,
    showPresses,
    showTradeNetwork,
    showEpigraphy,
    showVici,
    showPorts,
    roadsLoading,
    settlementsLoading,
    limesLoading,
    presenceLoading,
    provincesLoading,
    fortificationsLoading,
    waterLoading,
    itinereRoadsLoading,
    battlesLoading,
    amphitheatersLoading,
    emperorsLoading,
    legionsLoading,
    shipwrecksLoading,
    minesLoading,
    aqueductsLoading,
    religionLoading,
    buildingsLoading,
    pressesLoading,
    tradeNetworkLoading,
    epigraphyLoading,
    viciLoading,
    portsLoading,
    settlementsData,
    settlementTypes,
    activePreset,
    toggleRoads,
    toggleSettlements,
    toggleLimes,
    togglePresence,
    toggleProvinces,
    toggleFortifications,
    toggleWater,
    toggleItinereRoads,
    toggleBattles,
    toggleAmphitheaters,
    toggleEmperors,
    toggleLegions,
    toggleShipwrecks,
    toggleMines,
    toggleAqueducts,
    toggleReligion,
    toggleBuildings,
    togglePresses,
    toggleTradeNetwork,
    toggleEpigraphy,
    toggleVici,
    togglePorts,
    toggleSettlementType,
    activatePreset,
  } = store

  // Map layer keys to their state
  const layerState: Record<string, { active: boolean; loading: boolean; toggle: () => void }> = {
    Territories: { active: showTerritories, loading: false, toggle: onToggleTerritories },
    Roads: { active: showRoads, loading: roadsLoading, toggle: toggleRoads },
    ItinereRoads: {
      active: showItinereRoads,
      loading: itinereRoadsLoading,
      toggle: toggleItinereRoads,
    },
    Settlements: {
      active: showSettlements,
      loading: settlementsLoading,
      toggle: toggleSettlements,
    },
    Limes: { active: showLimes, loading: limesLoading, toggle: toggleLimes },
    Provinces: { active: showProvinces, loading: provincesLoading, toggle: toggleProvinces },
    Fortifications: {
      active: showFortifications,
      loading: fortificationsLoading,
      toggle: toggleFortifications,
    },
    Water: { active: showWater, loading: waterLoading, toggle: toggleWater },
    Presence: { active: showPresence, loading: presenceLoading, toggle: togglePresence },
    Battles: { active: showBattles, loading: battlesLoading, toggle: toggleBattles },
    Amphitheaters: {
      active: showAmphitheaters,
      loading: amphitheatersLoading,
      toggle: toggleAmphitheaters,
    },
    Emperors: { active: showEmperors, loading: emperorsLoading, toggle: toggleEmperors },
    Legions: { active: showLegions, loading: legionsLoading, toggle: toggleLegions },
    Shipwrecks: { active: showShipwrecks, loading: shipwrecksLoading, toggle: toggleShipwrecks },
    Mines: { active: showMines, loading: minesLoading, toggle: toggleMines },
    Aqueducts: { active: showAqueducts, loading: aqueductsLoading, toggle: toggleAqueducts },
    Religion: { active: showReligion, loading: religionLoading, toggle: toggleReligion },
    Buildings: { active: showBuildings, loading: buildingsLoading, toggle: toggleBuildings },
    Presses: { active: showPresses, loading: pressesLoading, toggle: togglePresses },
    TradeNetwork: {
      active: showTradeNetwork,
      loading: tradeNetworkLoading,
      toggle: toggleTradeNetwork,
    },
    Epigraphy: { active: showEpigraphy, loading: epigraphyLoading, toggle: toggleEpigraphy },
    Vici: { active: showVici, loading: viciLoading, toggle: toggleVici },
    Ports: { active: showPorts, loading: portsLoading, toggle: togglePorts },
  }

  const typeCounts = useMemo(() => {
    if (!settlementsData) return []
    const counts: Record<number, number> = {}
    for (const s of settlementsData) {
      counts[s.type] = (counts[s.type] || 0) + 1
    }
    return Object.entries(DARE_TYPE_LABELS)
      .map(([k, label]) => ({ type: Number(k), label, count: counts[Number(k)] || 0 }))
      .sort((a, b) => b.count - a.count)
  }, [settlementsData])

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  const contentProps: LayerPanelContentProps = {
    layerState,
    typeCounts,
    collapsedGroups,
    toggleGroup,
    activePreset,
    activatePreset,
    showSettlements,
    settlementTypes,
    toggleSettlementType,
  }

  return (
    <>
      {/* Toggle button */}
      <div className="absolute top-3 right-3 z-[1000]" style={{ pointerEvents: 'all' }}>
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className="flex items-center justify-center size-10 rounded-xl bg-[#0f0a1a]/80 backdrop-blur-md border border-white/10 text-white/80 hover:text-white transition-colors"
          aria-label="Toggle layers"
        >
          <Layers className="size-5" />
        </button>
      </div>

      {/* Desktop panel */}
      {panelOpen && !isMobile && (
        <div
          className="absolute right-0 top-0 z-[999] h-full w-[260px] bg-[#0f0a1a]/92 backdrop-blur-md border-l border-white/10 rounded-l-xl"
          style={{ pointerEvents: 'all' }}
        >
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <span className="text-sm font-semibold text-text-primary">Layers</span>
            <Button variant="ghost" size="icon-sm" onClick={() => setPanelOpen(false)}>
              <X className="size-4" />
            </Button>
          </div>
          <ScrollArea className="h-[calc(100%-56px)]">
            <LayerPanelContent {...contentProps} />
          </ScrollArea>
        </div>
      )}

      {/* Mobile drawer */}
      {isMobile && (
        <Drawer open={panelOpen} onOpenChange={setPanelOpen}>
          <DrawerContent className="bg-bg-card border-border max-h-[60vh]">
            <DrawerHeader>
              <DrawerTitle>Layers</DrawerTitle>
            </DrawerHeader>
            <ScrollArea className="flex-1 overflow-auto">
              <LayerPanelContent {...contentProps} />
            </ScrollArea>
          </DrawerContent>
        </Drawer>
      )}
    </>
  )
}
