import { useMemo, useState } from 'react'
import { useMapLayerStore, PRESETS, LAYER_GROUPS } from '@/stores/useMapLayerStore'
import type { PresetName } from '@/stores/useMapLayerStore'
import { DARE_TYPE_LABELS, CATEGORY_STYLES, DARE_TYPE_TO_CATEGORY } from './settlementStyles'

interface MapControlsProps {
  showTerritories: boolean
  onToggleTerritories: () => void
}

function LayerToggle({
  label,
  active,
  loading,
  onClick,
  activeClass,
}: {
  label: string
  active: boolean
  loading?: boolean
  onClick: () => void
  activeClass: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={[
        'px-3 py-1.5 text-xs font-medium rounded border transition-colors w-full text-left',
        loading
          ? 'bg-black/60 border-white/20 text-white/40 cursor-wait'
          : active
            ? activeClass
            : 'bg-black/60 border-white/20 text-white/70 hover:bg-black/80',
      ].join(' ')}
      title={`Toggle ${label.toLowerCase()} layer`}
    >
      {loading ? `${label}...` : label}
    </button>
  )
}

function PresetButton({
  label,
  description,
  active,
  onClick,
}: {
  label: string
  description: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'px-2.5 py-1 text-[10px] font-medium rounded border transition-colors text-left w-full',
        active
          ? 'bg-amber-900/80 border-amber-600 text-amber-100'
          : 'bg-black/40 border-white/10 text-white/60 hover:bg-black/60 hover:text-white/80',
      ].join(' ')}
      title={description}
    >
      {label}
    </button>
  )
}

export function MapControls({ showTerritories, onToggleTerritories }: MapControlsProps) {
  const [showPresets, setShowPresets] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

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

  return (
    <div
      className="absolute top-3 right-3 z-[1000] flex flex-col gap-0.5"
      style={{
        pointerEvents: 'all',
        maxHeight: 'calc(100vh - 120px)',
        overflowY: 'auto',
        width: 160,
      }}
    >
      {/* Preset buttons */}
      <button
        onClick={() => setShowPresets(!showPresets)}
        className={[
          'px-3 py-1.5 text-xs font-bold rounded border transition-colors w-full text-left',
          showPresets
            ? 'bg-amber-900/80 border-amber-600 text-amber-100'
            : 'bg-black/60 border-amber-700/50 text-amber-200/80 hover:bg-black/80',
        ].join(' ')}
      >
        {showPresets ? '\u25BC' : '\u25B6'} Presets
      </button>

      {showPresets && (
        <div className="flex flex-col gap-0.5 rounded border border-white/10 bg-black/80 p-1.5">
          {(
            Object.entries(PRESETS) as [
              Exclude<PresetName, 'custom'>,
              (typeof PRESETS)[keyof typeof PRESETS],
            ][]
          ).map(([key, preset]) => (
            <PresetButton
              key={key}
              label={preset.label}
              description={preset.description}
              active={activePreset === key}
              onClick={() => activatePreset(key)}
            />
          ))}
        </div>
      )}

      {/* Layer groups */}
      {LAYER_GROUPS.map((group) => {
        const isCollapsed = collapsedGroups.has(group.label)
        const activeCount = group.layers.filter((l) => layerState[l.key]?.active).length

        return (
          <div key={group.label} className="flex flex-col gap-0.5">
            <button
              onClick={() => toggleGroup(group.label)}
              className="px-2 py-0.5 text-[10px] font-bold text-white/50 uppercase tracking-wider text-left hover:text-white/70 flex items-center gap-1"
            >
              <span className="text-[8px]">{isCollapsed ? '\u25B6' : '\u25BC'}</span>
              {group.label}
              {activeCount > 0 && (
                <span className="ml-auto text-amber-400/70 text-[9px]">{activeCount}</span>
              )}
            </button>
            {!isCollapsed &&
              group.layers.map((layer) => {
                const state = layerState[layer.key]
                if (!state) return null
                return (
                  <div key={layer.key}>
                    <LayerToggle
                      label={layer.label}
                      active={state.active}
                      loading={state.loading}
                      onClick={state.toggle}
                      activeClass={layer.activeClass}
                    />
                    {/* Settlement type submenu */}
                    {layer.key === 'Settlements' && showSettlements && typeCounts.length > 0 && (
                      <div
                        className="rounded border border-white/20 bg-black/80 overflow-y-auto mt-0.5"
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
                              className={[
                                'flex items-center gap-1.5 w-full px-2 py-0.5 text-[10px] text-left transition-colors hover:bg-white/10',
                                enabled ? 'text-white/90' : 'text-white/30',
                              ].join(' ')}
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
        )
      })}
    </div>
  )
}
