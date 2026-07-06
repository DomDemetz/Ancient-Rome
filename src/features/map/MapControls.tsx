import { useCallback, useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/shallow'
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
  Plus,
  Minus,
} from 'lucide-react'
import type { Map as LeafletMap } from 'leaflet'
import { useMapLayerStore, PRESETS, LAYER_GROUPS } from '@/stores/useMapLayerStore'
import type { PresetName } from '@/stores/useMapLayerStore'
import { DARE_TYPE_LABELS, CATEGORY_STYLES, DARE_TYPE_TO_CATEGORY } from './layers/settlementStyles'
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
  mapRef?: React.RefObject<LeafletMap | null>
}

function ZoomControls({
  panelOpen,
  mapRef,
}: {
  panelOpen: boolean
  mapRef?: React.RefObject<LeafletMap | null>
}) {
  const handleZoomIn = useCallback(() => mapRef?.current?.zoomIn(), [mapRef])
  const handleZoomOut = useCallback(() => mapRef?.current?.zoomOut(), [mapRef])

  return (
    <div
      className={`absolute z-[1001] bottom-6 transition-all duration-200 ${
        panelOpen ? 'right-[276px]' : 'right-3'
      }`}
      style={{ pointerEvents: 'all' }}
    >
      <div className="flex flex-col gap-1">
        <button
          onClick={handleZoomIn}
          className="flex items-center justify-center size-11 min-w-[44px] min-h-[44px] rounded-lg bg-[#0a0a0c]/85 backdrop-blur-md border border-white/[0.08] text-slate-400 hover:text-white hover:border-white/[0.12] active:text-amber-400 transition-all shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
          aria-label="Zoom in"
        >
          <Plus className="size-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="flex items-center justify-center size-11 min-w-[44px] min-h-[44px] rounded-lg bg-[#0a0a0c]/85 backdrop-blur-md border border-white/[0.08] text-slate-400 hover:text-white hover:border-white/[0.12] active:text-amber-400 transition-all shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
          aria-label="Zoom out"
        >
          <Minus className="size-4" />
        </button>
      </div>
    </div>
  )
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
    <div className="p-3 space-y-3">
      {/* Presets */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-500/50 mb-2">
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
                  'px-3 py-2 text-xs font-medium rounded-full transition-all min-h-[36px]',
                  active
                    ? 'bg-amber-600 text-white shadow-lg'
                    : 'text-slate-500 hover:text-white active:text-white bg-transparent border border-white/[0.06] rounded-full',
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
              className="w-full flex items-center gap-2 py-2 min-h-[40px] text-[10px] font-bold uppercase tracking-[0.15em] text-amber-500/50 hover:text-amber-500 active:text-amber-500 transition-colors"
            >
              {GroupIcon && <GroupIcon className="size-3.5" />}
              <span>{group.label}</span>
              {activeCount > 0 && (
                <span className="ml-1 text-amber-500 text-[10px]">{activeCount}</span>
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
                          'w-full flex items-center gap-2 px-3 py-2 min-h-[40px] text-xs rounded-lg transition-colors text-left',
                          state.loading
                            ? 'border-l-2 border-amber-500/30 text-slate-500 cursor-wait animate-pulse'
                            : state.active
                              ? 'border-l-2 border-amber-500 bg-white/[0.03] text-white'
                              : 'border-l-2 border-transparent text-slate-500 hover:bg-white/[0.03] hover:text-white active:bg-white/[0.03] active:text-white',
                        )}
                        title={`Toggle ${layer.label.toLowerCase()} layer`}
                      >
                        <span className="flex-1">
                          {state.loading ? `${layer.label}...` : layer.label}
                        </span>
                        {state.loading ? (
                          <span className="size-2 rounded-full shrink-0 bg-amber-500/40 animate-pulse" />
                        ) : (
                          <span
                            className={cn(
                              'size-2 rounded-full shrink-0 transition-colors',
                              state.active ? 'bg-amber-500' : 'bg-white/[0.08]',
                            )}
                          />
                        )}
                      </button>

                      {/* Settlement type submenu */}
                      {layer.key === 'Settlements' && showSettlements && typeCounts.length > 0 && (
                        <div
                          className="rounded-xl border border-white/[0.04] bg-white/[0.02] overflow-y-auto mt-1"
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
                                  'flex items-center gap-1.5 w-full px-2.5 py-1.5 min-h-[36px] text-[10px] text-left transition-colors hover:bg-white/10 active:bg-white/10 rounded',
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

export function MapControls({ showTerritories, onToggleTerritories, mapRef }: MapControlsProps) {
  // First-time discoverability: open the layers panel once so new visitors
  // immediately see the presets and 20+ toggleable layers. Desktop only (a
  // full-screen drawer would be intrusive on mobile). Decided synchronously so
  // the panel is open on first paint; the "seen" flag is persisted in an effect.
  const [panelOpen, setPanelOpen] = useState(() => {
    try {
      return !localStorage.getItem('layersPanelSeen') && window.innerWidth >= 768
    } catch {
      return false
    }
  })
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const isMobile = useUIStore((s) => s.isMobile)

  useEffect(() => {
    if (panelOpen) {
      try {
        localStorage.setItem('layersPanelSeen', '1')
      } catch {
        /* localStorage unavailable (private mode) — skip */
      }
    }
    // Persist once on mount based on the initial decision.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const {
    showRoads,
    showSettlements,
    showCities,
    showEmpires,
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
    showNotablePeople,
    showUnifiedVillas,
    showUnifiedTemples,
    showUnifiedBridges,
    showUnifiedTombs,
    unifiedLoading,
    roadsLoading,
    placesLoading,
    empiresLoading,
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
    notablePeopleLoading,
    placesData,
    settlementTypes,
    activePreset,
    toggleRoads,
    toggleSettlements,
    toggleCities,
    toggleEmpires,
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
    toggleNotablePeople,
    toggleUnifiedVillas,
    toggleUnifiedTemples,
    toggleUnifiedBridges,
    toggleUnifiedTombs,
    toggleSettlementType,
    activatePreset,
  } = useMapLayerStore(useShallow((s) => s))

  // Map layer keys to their state
  const layerState: Record<string, { active: boolean; loading: boolean; toggle: () => void }> = {
    Territories: { active: showTerritories, loading: false, toggle: onToggleTerritories },
    Roads: { active: showRoads, loading: roadsLoading, toggle: toggleRoads },
    ItinereRoads: {
      active: showItinereRoads,
      loading: itinereRoadsLoading,
      toggle: toggleItinereRoads,
    },
    Empires: {
      active: showEmpires,
      loading: empiresLoading,
      toggle: toggleEmpires,
    },
    Cities: {
      active: showCities,
      loading: placesLoading,
      toggle: toggleCities,
    },
    Settlements: {
      active: showSettlements,
      loading: placesLoading,
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
    NotablePeople: {
      active: showNotablePeople,
      loading: notablePeopleLoading,
      toggle: toggleNotablePeople,
    },
    UnifiedVillas: {
      active: showUnifiedVillas,
      loading: unifiedLoading,
      toggle: toggleUnifiedVillas,
    },
    UnifiedTemples: {
      active: showUnifiedTemples,
      loading: unifiedLoading,
      toggle: toggleUnifiedTemples,
    },
    UnifiedBridges: {
      active: showUnifiedBridges,
      loading: unifiedLoading,
      toggle: toggleUnifiedBridges,
    },
    UnifiedTombs: {
      active: showUnifiedTombs,
      loading: unifiedLoading,
      toggle: toggleUnifiedTombs,
    },
  }

  const typeCounts = useMemo(() => {
    if (!placesData) return []
    const counts: Record<number, number> = {}
    for (const p of placesData) {
      const t = p.dare?.type
      if (t != null) counts[t] = (counts[t] || 0) + 1
    }
    return Object.entries(DARE_TYPE_LABELS)
      .map(([k, label]) => ({ type: Number(k), label, count: counts[Number(k)] || 0 }))
      .sort((a, b) => b.count - a.count)
  }, [placesData])

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
      {/* Toggle button — unified glass control */}
      <div
        className={`absolute z-[1001] ${isMobile ? 'top-2 right-2' : 'top-3 right-3'}`}
        style={{ pointerEvents: 'all' }}
      >
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className={cn(
            'group flex items-center justify-center rounded-xl backdrop-blur-md border transition-all duration-200',
            isMobile
              ? 'size-10 shadow-[0_2px_12px_rgba(0,0,0,0.5)]'
              : 'gap-2 shadow-[0_4px_24px_rgba(0,0,0,0.5)]',
            panelOpen
              ? isMobile
                ? 'bg-amber-500/15 border-amber-500/25 text-amber-400'
                : 'bg-amber-500/15 border-amber-500/25 text-amber-400 px-3.5 py-2.5'
              : isMobile
                ? 'bg-[#0a0a0c]/80 border-white/[0.08] text-slate-400 active:text-amber-400'
                : 'bg-[#0a0a0c]/85 border-white/[0.08] text-slate-400 hover:text-white hover:border-white/[0.12] active:text-amber-400 px-3 py-2.5',
          )}
          aria-label="Toggle layers"
        >
          <Layers className={isMobile ? 'size-[18px]' : 'size-4'} />
          {!isMobile && (
            <span
              className={cn(
                'text-[10px] font-bold uppercase tracking-[0.1em] transition-all duration-200',
                panelOpen
                  ? 'opacity-100'
                  : 'opacity-0 w-0 overflow-hidden group-hover:opacity-100 group-hover:w-auto',
              )}
            >
              Layers
            </span>
          )}
        </button>
      </div>

      {/* Custom zoom controls — shift left when panel is open */}
      {!isMobile && <ZoomControls panelOpen={panelOpen} mapRef={mapRef} />}

      {/* Desktop panel */}
      {panelOpen && !isMobile && (
        <div
          className="absolute right-0 top-0 z-[1000] h-full w-[260px] bg-[#0c0c10]/95 backdrop-blur-md border-l border-white/[0.08] shadow-[-4px_0_24px_rgba(0,0,0,0.3)]"
          style={{ pointerEvents: 'all' }}
        >
          <div className="flex items-center justify-between p-4 border-b border-white/[0.08]">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/50 font-serif italic">
              Atlas Layers
            </span>
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
          <DrawerContent className="bg-[#0c0c10] border-white/[0.05] max-h-[75vh]">
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
