import { useState, useRef, useEffect, useMemo } from 'react'
import Fuse from 'fuse.js'
import { Search, X } from 'lucide-react'
import { entities } from '@/data'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { useFilterStore } from '@/stores/useFilterStore'
import { useMapLayerStore } from '@/stores/useMapLayerStore'
import { useMapNavStore } from '@/stores/useMapNavStore'
import { useUIStore } from '@/stores/useUIStore'
import { entityColors, entityLabels } from '@/lib/colors'
import { Input } from '@/ui/input'
import type { Entity } from '@/types'

const MAX_RESULTS = 8

// Maps search categories to their layer visibility flag and toggle action
const LAYER_MAP: Record<string, { show: string; toggle: string }> = {
  Road: { show: 'showRoads', toggle: 'toggleRoads' },
  Settlement: { show: 'showSettlements', toggle: 'toggleSettlements' },
  Battle: { show: 'showBattles', toggle: 'toggleBattles' },
  Legion: { show: 'showLegions', toggle: 'toggleLegions' },
  Amphitheater: { show: 'showAmphitheaters', toggle: 'toggleAmphitheaters' },
  Shipwreck: { show: 'showShipwrecks', toggle: 'toggleShipwrecks' },
  Mine: { show: 'showMines', toggle: 'toggleMines' },
  Aqueduct: { show: 'showAqueducts', toggle: 'toggleAqueducts' },
  'Religious site': { show: 'showReligion', toggle: 'toggleReligion' },
  Building: { show: 'showBuildings', toggle: 'toggleBuildings' },
  Press: { show: 'showPresses', toggle: 'togglePresses' },
  Port: { show: 'showPorts', toggle: 'togglePorts' },
}

interface SearchItem {
  id: string
  name: string
  category: string
  color: string
  lat?: number
  lng?: number
  entityId?: string // for graph entities
}

const CATEGORY_COLORS: Record<string, string> = {
  road: '#d4a74a',
  settlement: '#5b8dd9',
  battle: '#e74c3c',
  legion: '#c0392b',
  amphitheater: '#d4a574',
  shipwreck: '#3498db',
  mine: '#c88c5a',
  aqueduct: '#3498db',
  religion: '#9b59b6',
  building: '#f0c040',
  press: '#8b6914',
  port: '#e67e22',
}

export function SearchBar() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const select = useSelectionStore((s) => s.select)
  const setFilter = useFilterStore((s) => s.setFilter)
  const flyTo = useMapNavStore((s) => s.flyTo)
  const switchLens = useUIStore((s) => s.switchLens)
  const isMobile = useUIStore((s) => s.isMobile)

  const store = useMapLayerStore()

  // Build a unified search index from all data sources
  const searchItems = useMemo(() => {
    const items: SearchItem[] = []

    // Entities (people, events, locations, etc.)
    for (const e of entities) {
      const item: SearchItem = {
        id: `entity-${e.id}`,
        name: e.name,
        category: entityLabels[e.entityType] || e.entityType,
        color: entityColors[e.entityType] || '#95a5a6',
        entityId: e.id,
      }
      if (
        e.entityType === 'location' &&
        (e as Entity & { coordinates?: { lat: number; lng: number } }).coordinates
      ) {
        const loc = e as Entity & { coordinates: { lat: number; lng: number } }
        item.lat = loc.coordinates.lat
        item.lng = loc.coordinates.lng
      }
      items.push(item)
    }

    // Roads (from GeoJSON features)
    if (store.roadsData) {
      const seen = new Set<string>()
      for (const f of store.roadsData.features) {
        const name = f.properties?.name
        if (!name || seen.has(name)) continue
        seen.add(name)
        // Get centroid of first geometry coordinates
        const coords = getFeatureCentroid(f)
        items.push({
          id: `road-${name}`,
          name,
          category: 'Road',
          color: CATEGORY_COLORS.road,
          ...coords,
        })
      }
    }

    // Settlements
    if (store.settlementsData) {
      for (const s of store.settlementsData) {
        items.push({
          id: `settlement-${s.id}`,
          name: s.name,
          category: 'Settlement',
          color: CATEGORY_COLORS.settlement,
          lat: s.lat,
          lng: s.lng,
        })
      }
    }

    // Battles
    if (store.battlesData) {
      for (const b of store.battlesData) {
        items.push({
          id: `battle-${b.id}`,
          name: b.name,
          category: 'Battle',
          color: CATEGORY_COLORS.battle,
          lat: b.lat,
          lng: b.lng,
        })
      }
    }

    // Legions
    if (store.legionsData) {
      for (const l of store.legionsData) {
        const base = l.bases[0]
        if (!base) continue
        items.push({
          id: `legion-${l.id}`,
          name: l.name,
          category: 'Legion',
          color: CATEGORY_COLORS.legion,
          lat: base.lat,
          lng: base.lng,
        })
      }
    }

    // Amphitheaters
    if (store.amphitheatersData) {
      for (const a of store.amphitheatersData) {
        items.push({
          id: `amphitheater-${a.id}`,
          name: a.name,
          category: 'Amphitheater',
          color: CATEGORY_COLORS.amphitheater,
          lat: a.lat,
          lng: a.lng,
        })
      }
    }

    // Shipwrecks
    if (store.shipwrecksData) {
      for (const w of store.shipwrecksData) {
        items.push({
          id: `shipwreck-${w.id}`,
          name: w.name,
          category: 'Shipwreck',
          color: CATEGORY_COLORS.shipwreck,
          lat: w.lat,
          lng: w.lng,
        })
      }
    }

    // Mines
    if (store.minesData) {
      for (const m of store.minesData) {
        items.push({
          id: `mine-${m.id}`,
          name: m.name,
          category: 'Mine',
          color: CATEGORY_COLORS.mine,
          lat: m.lat,
          lng: m.lng,
        })
      }
    }

    // Aqueducts
    if (store.aqueductsData) {
      for (const a of store.aqueductsData) {
        items.push({
          id: `aqueduct-${a.id}`,
          name: a.name,
          category: 'Aqueduct',
          color: CATEGORY_COLORS.aqueduct,
          lat: a.lat,
          lng: a.lng,
        })
      }
    }

    // Religious sites
    if (store.religionData) {
      for (const r of store.religionData) {
        items.push({
          id: `religion-${r.id}`,
          name: r.name,
          category: 'Religious site',
          color: CATEGORY_COLORS.religion,
          lat: r.lat,
          lng: r.lng,
        })
      }
    }

    // Buildings
    if (store.buildingsData) {
      for (const b of store.buildingsData) {
        items.push({
          id: `building-${b.id}`,
          name: b.name,
          category: 'Building',
          color: CATEGORY_COLORS.building,
          lat: b.lat,
          lng: b.lng,
        })
      }
    }

    // Presses
    if (store.pressesData) {
      for (const p of store.pressesData) {
        items.push({
          id: `press-${p.id}`,
          name: p.name,
          category: 'Press',
          color: CATEGORY_COLORS.press,
          lat: p.lat,
          lng: p.lng,
        })
      }
    }

    // Ports
    if (store.portsData) {
      for (const p of store.portsData) {
        items.push({
          id: `port-${p.id}`,
          name: p.name,
          category: 'Port',
          color: CATEGORY_COLORS.port ?? '#3498db',
          lat: p.lat,
          lng: p.lng,
        })
      }
    }

    return items
  }, [
    store.roadsData,
    store.settlementsData,
    store.battlesData,
    store.legionsData,
    store.amphitheatersData,
    store.shipwrecksData,
    store.minesData,
    store.aqueductsData,
    store.religionData,
    store.buildingsData,
    store.pressesData,
    store.portsData,
  ])

  const fuse = useMemo(
    () =>
      new Fuse(searchItems, {
        keys: ['name'],
        threshold: 0.3,
      }),
    [searchItems],
  )

  const results = useMemo(() => {
    if (!query.trim()) return []
    return fuse.search(query, { limit: MAX_RESULTS }).map((r) => r.item)
  }, [fuse, query])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cmd+K / Ctrl+K global shortcut to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (isMobile) {
          setMobileOpen(true)
        } else {
          inputRef.current?.focus()
          setOpen(true)
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isMobile])

  function handleSelect(item: SearchItem) {
    setQuery(item.name)
    setOpen(false)
    setMobileOpen(false)

    // If it's a graph entity, select it
    if (item.entityId) {
      select(item.entityId)
      setFilter('searchQuery', item.name)
    }

    // Ensure the layer is visible
    const layerInfo = LAYER_MAP[item.category]
    if (layerInfo) {
      const state = useMapLayerStore.getState() as unknown as Record<string, unknown>
      const isVisible = state[layerInfo.show]
      if (!isVisible) {
        const toggle = state[layerInfo.toggle] as () => void
        toggle()
      }
    }

    // If it has coordinates, switch to map and fly there
    if (item.lat != null && item.lng != null) {
      switchLens('map')
      flyTo(item.lat, item.lng, 9)
    }
  }

  const resultsDropdown = open && results.length > 0 && (
    <ul
      className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-white/[0.06] bg-black/95 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden"
      style={{ zIndex: 1001 }}
    >
      {results.map((item) => (
        <li key={item.id}>
          <button
            className="w-full flex items-center gap-2 px-3 py-2.5 min-h-[44px] text-left text-xs hover:bg-white/[0.04] active:bg-white/[0.06] transition-colors"
            onMouseDown={(e) => {
              e.preventDefault()
              handleSelect(item)
            }}
          >
            <span
              className="size-2 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-slate-500 shrink-0">{item.category}</span>
            <span className="text-slate-100 truncate">{item.name}</span>
          </button>
        </li>
      ))}
    </ul>
  )

  // Mobile: icon trigger + overlay
  if (isMobile) {
    return (
      <>
        <button
          onClick={() => {
            setMobileOpen(true)
            setOpen(true)
          }}
          className="flex items-center justify-center size-9 min-h-[44px] min-w-[44px] rounded-lg text-slate-500 active:text-white transition-colors"
          aria-label="Search"
        >
          <Search className="size-4" />
        </button>
        {mobileOpen && (
          <>
            {/* Backdrop scrim */}
            <div
              className="fixed inset-0 z-[1099] bg-black/60 backdrop-blur-sm"
              onClick={() => {
                setMobileOpen(false)
                setOpen(false)
                setQuery('')
              }}
            />
            <div
              className="fixed inset-x-0 top-0 z-[1100] bg-[#0a0a0c] p-3 border-b border-white/[0.06] shadow-lg"
              style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
            >
              <div ref={containerRef} className="relative">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search the Empire..."
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value)
                        setOpen(true)
                      }}
                      onFocus={() => setOpen(true)}
                      autoFocus
                      className="w-full rounded-xl h-10 pl-9 pr-3 text-sm bg-white/[0.04] border border-white/[0.06] text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/30 focus:shadow-[0_0_20px_rgba(245,158,11,0.08)]"
                    />
                  </div>
                  <button
                    onClick={() => {
                      setMobileOpen(false)
                      setOpen(false)
                      setQuery('')
                    }}
                    className="flex items-center justify-center size-9 min-h-[44px] min-w-[44px] rounded-full text-slate-500 hover:text-slate-100 transition-colors"
                    aria-label="Close search"
                  >
                    <X className="size-5" />
                  </button>
                </div>
                {resultsDropdown}
              </div>
            </div>
          </>
        )}
      </>
    )
  }

  // Desktop
  return (
    <div ref={containerRef} className="relative w-80 lg:w-96 mx-2">
      <div className="relative rounded-xl bg-white/[0.03] border border-white/[0.08] focus-within:border-amber-500/30 focus-within:bg-white/[0.05] focus-within:shadow-[0_0_24px_rgba(245,158,11,0.06)] transition-all">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-500 pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search the Empire..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          className="pl-8 pr-12 h-8 text-sm bg-transparent border-none text-white placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-600 bg-white/[0.05] px-1.5 py-0.5 rounded pointer-events-none">
          ⌘K
        </span>
      </div>

      {resultsDropdown}
    </div>
  )
}

/** Extract a centroid from a GeoJSON feature for flyTo */
function getFeatureCentroid(
  feature: import('geojson').Feature,
): { lat: number; lng: number } | Record<string, never> {
  const geom = feature.geometry
  if (!geom) return {}

  if (geom.type === 'Point') {
    return { lat: geom.coordinates[1], lng: geom.coordinates[0] }
  }

  // For LineString, MultiLineString, etc. — average the coordinates
  const coords: number[][] = []
  function collect(c: unknown) {
    if (Array.isArray(c)) {
      if (typeof c[0] === 'number') {
        coords.push(c as number[])
      } else {
        for (const sub of c) collect(sub)
      }
    }
  }
  collect((geom as { coordinates: unknown }).coordinates)

  if (coords.length === 0) return {}

  // Use midpoint of the line rather than average (more representative)
  const mid = coords[Math.floor(coords.length / 2)]
  return { lat: mid[1], lng: mid[0] }
}
