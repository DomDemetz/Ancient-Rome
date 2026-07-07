import { useState, useRef, useEffect, useMemo } from 'react'
import Fuse from 'fuse.js'
import { useShallow } from 'zustand/shallow'
import { Search, X } from 'lucide-react'
import { entities } from '@/data'
import citiesSearchJson from '@/data/registry/cities-search.json'

// Tiny build-time manifest of the Chandler cities (see ENTITY-MODEL.md):
// name, coords, lifespan within the atlas window, and peak-population year.
interface CitySearchEntry {
  id: string
  n: string
  lat: number
  lng: number
  s: number
  e: number
  p: number
}
const CITY_SEARCH = citiesSearchJson as CitySearchEntry[]

import emperorsSearchJson from '@/data/registry/emperors-search.json'
import battlesSearchJson from '@/data/registry/battles-search.json'
import empiresSearchJson from '@/data/registry/empires-search.json'
import peopleSearchJson from '@/data/registry/people-search.json'
interface EmperorSearchEntry {
  id: string
  n: string
  s: number
  e: number
  d: string
}
interface BattleSearchEntry {
  id: string
  n: string
  y: number
  lat: number
  lng: number
}
interface PersonSearchEntry {
  id: string
  n: string
  lat: number
  lng: number
  b: number
  d: number | null
  r: string
}
interface SiteSearchEntry {
  id: string
  n: string
  lat: number
  lng: number
  t: string
}
const EMPEROR_SEARCH = emperorsSearchJson as EmperorSearchEntry[]
const BATTLE_SEARCH = battlesSearchJson as BattleSearchEntry[]
const EMPIRE_SEARCH = empiresSearchJson as CitySearchEntry[]
const PEOPLE_SEARCH = peopleSearchJson as PersonSearchEntry[]

let _siteSearchCache: SiteSearchEntry[] | null = null
let _siteSearchPromise: Promise<SiteSearchEntry[]> | null = null
function loadSiteSearch(): Promise<SiteSearchEntry[]> {
  if (_siteSearchCache) return Promise.resolve(_siteSearchCache)
  if (!_siteSearchPromise) {
    _siteSearchPromise = import('@/data/registry/buildings-search.json').then((m) => {
      _siteSearchCache = m.default as SiteSearchEntry[]
      return _siteSearchCache
    })
  }
  return _siteSearchPromise
}
loadSiteSearch()
import { useSelectionStore } from '@/stores/useSelectionStore'
import { useFeatureDetailStore } from '@/stores/useFeatureDetailStore'
import { useFilterStore } from '@/stores/useFilterStore'
import { useMapLayerStore } from '@/stores/useMapLayerStore'
import { useMapNavStore } from '@/stores/useMapNavStore'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useUIStore } from '@/stores/useUIStore'
import { entityColors, entityLabels } from '@/lib/colors'
import { formatYear } from '@/lib/geo'
import { Input } from '@/ui/input'
import type { Entity } from '@/types'

const MAX_RESULTS = 8

// Maps search categories to their layer visibility flag and toggle action.
// `dataset` entries use the registry-driven datasetState system.
const LAYER_MAP: Record<string, { show?: string; toggle?: string; dataset?: string }> = {
  Road: { show: 'showRoads', toggle: 'toggleRoads' },
  Settlement: { show: 'showSettlements', toggle: 'toggleSettlements' },
  Battle: { show: 'showBattles', toggle: 'toggleBattles' },
  Legion: { show: 'showLegions', toggle: 'toggleLegions' },
  Amphitheater: { show: 'showAmphitheaters', toggle: 'toggleAmphitheaters' },
  Aqueduct: { show: 'showAqueducts', toggle: 'toggleAqueducts' },
  Building: { show: 'showBuildings', toggle: 'toggleBuildings' },
  City: { show: 'showCities', toggle: 'toggleCities' },
  Emperor: { show: 'showEmperors', toggle: 'toggleEmperors' },
  Empire: { show: 'showEmpires', toggle: 'toggleEmpires' },
  Person: { show: 'showNotablePeople', toggle: 'toggleNotablePeople' },
  Shipwreck: { dataset: 'shipwrecks' },
  Mine: { dataset: 'mines' },
  'Religious site': { dataset: 'religion' },
  Press: { dataset: 'presses' },
  Port: { dataset: 'ports' },
  Villa: { dataset: 'villas' },
  Temple: { dataset: 'temples' },
  Bridge: { dataset: 'bridges' },
  Tomb: { dataset: 'tombs' },
}

interface SearchItem {
  id: string
  name: string
  category: string
  color: string
  lat?: number
  lng?: number
  entityId?: string // for graph entities
  year?: number // for time-filtered features (battle/shipwreck/legion) — jump the timeline so the marker is actually visible on arrival
  lifespan?: [number, number] // cities: only jump time if outside this range
  zoom?: number // flyTo zoom override (empires want ~4, not 9)
  sub?: string // right-aligned secondary line (reign, year, role) — eight Constantines need telling apart
}

const CATEGORY_COLORS: Record<string, string> = {
  road: '#d4a74a',
  settlement: '#5b8dd9',
  city: '#f59e0b',
  emperor: '#d4af37',
  empire: '#818cf8',
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
  person: '#a855f7',
  tomb: '#9ca3af',
  villa: '#84cc16',
  temple: '#d946ef',
  bridge: '#38bdf8',
}

export function SearchBar() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [siteSearch, setSiteSearch] = useState<SiteSearchEntry[]>(_siteSearchCache ?? [])
  const [activeIdx, setActiveIdx] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const select = useSelectionStore((s) => s.select)
  const setFilter = useFilterStore((s) => s.setFilter)
  const flyTo = useMapNavStore((s) => s.flyTo)
  const setYear = useTimelineStore((s) => s.setYear)
  const switchLens = useUIStore((s) => s.switchLens)
  const isMobile = useUIStore((s) => s.isMobile)

  const layerData = useMapLayerStore(
    useShallow((s) => ({
      roadsData: s.roadsData,
      placesData: s.placesData,
      legionsData: s.legionsData,
    })),
  )

  useEffect(() => {
    if (!_siteSearchCache) loadSiteSearch().then(setSiteSearch)
  }, [])

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
    if (layerData.roadsData) {
      const seen = new Set<string>()
      for (const f of layerData.roadsData.features) {
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

    // Emperors — searching "Justinian" jumps the timeline to his reign
    for (const e of EMPEROR_SEARCH) {
      items.push({
        id: `emperor-${e.id}`,
        name: e.n,
        category: 'Emperor',
        color: CATEGORY_COLORS.emperor,
        year: Math.round((e.s + e.e) / 2), // mid-reign, so the banner shows them
        sub: `r. ${formatYear(e.s)} \u2013 ${formatYear(e.e)}`,
      })
    }

    // Battles — always searchable via manifest (replaces lazy layer indexing)
    for (const b of BATTLE_SEARCH) {
      items.push({
        id: `battle-${b.id}`,
        name: b.n,
        category: 'Battle',
        color: CATEGORY_COLORS.battle,
        lat: b.lat,
        lng: b.lng,
        year: b.y,
        sub: formatYear(b.y),
      })
    }

    // World polities — searching "Sasanian Empire" turns the world on
    for (const e of EMPIRE_SEARCH) {
      items.push({
        id: `empire-${e.id}`,
        name: e.n,
        category: 'Empire',
        color: CATEGORY_COLORS.empire,
        lat: e.lat,
        lng: e.lng,
        year: e.p,
        lifespan: [e.s, e.e],
        zoom: 4,
        sub: `${formatYear(e.s)} \u2013 ${formatYear(e.e)}`,
      })
    }

    // Notable people — searchable via manifest; clicking flies to birthplace
    for (const p of PEOPLE_SEARCH) {
      items.push({
        id: `person-${p.id}`,
        name: p.n,
        category: 'Person',
        color: CATEGORY_COLORS.person,
        lat: p.lat,
        lng: p.lng,
        year: p.b > 0 ? p.b : p.d != null ? p.d : undefined,
        sub: p.r,
      })
    }

    // Notable buildings & archaeological sites — always searchable via manifest
    const siteLabels: Record<string, string> = {
      building: 'Building',
      amphitheater: 'Amphitheater',
      tomb: 'Tomb',
      villa: 'Villa',
      temple: 'Temple',
      bridge: 'Bridge',
      mine: 'Mine',
      aqueduct: 'Aqueduct',
      shipwreck: 'Shipwreck',
      religion: 'Religious site',
      press: 'Press',
      port: 'Port',
    }
    for (const s of siteSearch) {
      items.push({
        id: `site-${s.t}-${s.id}`,
        name: s.n,
        category: siteLabels[s.t] ?? s.t,
        color: CATEGORY_COLORS[s.t] || CATEGORY_COLORS.building,
        lat: s.lat,
        lng: s.lng,
      })
    }

    // Major cities (Chandler) — always searchable; the manifest is tiny
    for (const c of CITY_SEARCH) {
      items.push({
        id: `city-${c.id}`,
        name: c.n,
        category: 'City',
        color: CATEGORY_COLORS.city,
        lat: c.lat,
        lng: c.lng,
        year: c.p,
        lifespan: [c.s, c.e],
      })
    }

    // Canonical places (minor settlements; major cities come from the
    // eager manifest above — skip population nodes to avoid duplicates)
    if (layerData.placesData) {
      for (const p of layerData.placesData) {
        if (p.populations) continue
        const entry: SearchItem = {
          id: `settlement-${p.id}`,
          name: p.name,
          category: 'Settlement',
          color: CATEGORY_COLORS.settlement,
          lat: p.lat,
          lng: p.lng,
        }
        if (p.startYear !== 0) {
          entry.year = p.startYear
          if (p.endYear !== 0) {
            entry.lifespan = [p.startYear, p.endYear]
            entry.sub = `${formatYear(p.startYear)} – ${formatYear(p.endYear)}`
          } else {
            entry.sub = formatYear(p.startYear)
          }
        }
        items.push(entry)
      }
    }

    // Legions
    if (layerData.legionsData) {
      for (const l of layerData.legionsData) {
        const base = l.bases[0]
        if (!base) continue
        items.push({
          id: `legion-${l.id}`,
          name: l.name,
          category: 'Legion',
          color: CATEGORY_COLORS.legion,
          lat: base.lat,
          lng: base.lng,
          // A base's fromYear is guaranteed inside the legion's active range,
          // so the deployment marker will render at that year.
          year: base.fromYear,
        })
      }
    }

    return items
  }, [layerData, siteSearch])

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
    const raw = fuse.search(query, { limit: MAX_RESULTS * 4 })
    const q = query.trim().toLowerCase()
    const PRIORITY: Record<string, number> = {
      City: 0,
      // legacy graph markers rank below cities: same name+coords dedupe
      // then keeps the richer City result (flies, time-jumps, and its node
      // popup carries the entity connections anyway)
      Location: 1,
      Emperor: 1,
      Battle: 1,
      Legion: 2,
      Amphitheater: 3,
      Building: 3,
      Temple: 3,
      Person: 2,
      Port: 3,
      Road: 3,
      Villa: 4,
      Tomb: 4,
      Bridge: 4,
      Mine: 4,
      Aqueduct: 4,
      Settlement: 5,
    }
    raw.sort((a, b) => {
      const aExact = a.item.name.toLowerCase() === q ? -2 : 0
      const bExact = b.item.name.toLowerCase() === q ? -2 : 0
      const aPrefix = !aExact && a.item.name.toLowerCase().startsWith(q) ? -1 : 0
      const bPrefix = !bExact && b.item.name.toLowerCase().startsWith(q) ? -1 : 0
      const aRank = aExact + aPrefix + (PRIORITY[a.item.category] ?? 4)
      const bRank = bExact + bPrefix + (PRIORITY[b.item.category] ?? 4)
      if (aRank !== bRank) return aRank - bRank
      return (a.score ?? 1) - (b.score ?? 1)
    })
    const seen = new Set<string>()
    const catCount: Record<string, number> = {}
    const out: SearchItem[] = []
    for (const r of raw) {
      const dedup = `${r.item.name}|${r.item.lat?.toFixed(2)},${r.item.lng?.toFixed(2)}`
      if (seen.has(dedup)) continue
      seen.add(dedup)
      const isExactish = r.item.name.toLowerCase().startsWith(q)
      const cat = r.item.category
      const cc = catCount[cat] ?? 0
      if (!isExactish && cc >= 2) continue
      catCount[cat] = cc + 1
      out.push(r.item)
      if (out.length >= MAX_RESULTS) break
    }
    return out
  }, [fuse, query])

  // Reset keyboard highlight when the result set changes — done during
  // render (React's "adjust state when props change" pattern), not in an
  // effect, to avoid a cascading re-render.
  const [prevResults, setPrevResults] = useState(results)
  if (prevResults !== results) {
    setPrevResults(results)
    setActiveIdx(-1)
  }

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

  // Cmd+K / Ctrl+K global shortcut to focus search; Escape to close
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
      if (e.key === 'Escape') {
        setOpen(false)
        setMobileOpen(false)
        inputRef.current?.blur()
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
      if (layerInfo.dataset) {
        const ds = useMapLayerStore.getState().datasetState[layerInfo.dataset]
        if (!ds?.show) {
          useMapLayerStore.getState().toggleDataset(layerInfo.dataset)
        }
      } else if (layerInfo.show) {
        const state = useMapLayerStore.getState() as unknown as Record<string, unknown>
        const isVisible = state[layerInfo.show]
        if (!isVisible) {
          const toggle = state[layerInfo.toggle!] as () => void
          toggle()
        }
      }
    }

    // Time-filtered features (battles, legions, shipwrecks) only render near
    // their own year. Jump the timeline so the marker is actually on screen
    // when we arrive — otherwise the user lands on an empty spot.
    if (item.year != null) {
      if (item.lifespan) {
        // Cities live across a range — only jump if it doesn't exist "now"
        const now = useTimelineStore.getState().currentYear
        if (now < item.lifespan[0] || now > item.lifespan[1]) setYear(item.year)
      } else {
        setYear(item.year)
      }
    }

    // People: open the detail sidepanel with their Wikipedia extract
    if (item.category === 'Person') {
      const qid = item.id.replace('person-', '')
      useFeatureDetailStore.getState().openFeature(qid, 'people', qid)
    }

    // Sites from the eager manifest: open the cross-ref detail panel
    if (item.id.startsWith('site-')) {
      const rest = item.id.slice(5) // strip 'site-'
      const dashIdx = rest.indexOf('-')
      const entityId = dashIdx >= 0 ? rest.slice(dashIdx + 1) : ''
      if (entityId) {
        useFeatureDetailStore.getState().openFeature(entityId, 'crossref')
      }
    }

    // Settlements: open cross-ref panel (wd- places use their ID directly)
    if (item.id.startsWith('settlement-')) {
      const placeId = item.id.replace('settlement-', '')
      const crKey = placeId.startsWith('wd-') ? placeId : `settlement:${placeId}`
      useFeatureDetailStore.getState().openFeature(crKey, 'crossref')
    }

    // If it has coordinates, switch to map and fly there
    if (item.lat != null && item.lng != null) {
      switchLens('map')
      flyTo(item.lat, item.lng, item.zoom ?? 9)
    }
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => (i < results.length - 1 ? i + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => (i > 0 ? i - 1 : results.length - 1))
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault()
      handleSelect(results[activeIdx])
    }
  }

  // Empty state: an empty dropdown is a dead end — suggest the range
  const SUGGESTIONS = ['Rome', 'Justinian I', 'Battle of Actium', 'Sasanian Empire', 'Alexandria']
  const emptyHints = open && !query.trim() && (
    <div
      className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-white/[0.06] bg-black/95 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.5)] px-3 py-2.5"
      style={{ zIndex: 1001 }}
    >
      <p className="text-[9px] uppercase tracking-[0.16em] text-slate-500 mb-1.5">
        Search cities, emperors, battles, empires
      </p>
      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((sug) => (
          <button
            key={sug}
            onMouseDown={(e) => {
              e.preventDefault()
              setQuery(sug)
            }}
            className="px-2.5 py-1 rounded-full border border-amber-500/25 text-[11px] text-amber-200/80 hover:bg-amber-500/10 transition-colors"
          >
            {sug}
          </button>
        ))}
      </div>
    </div>
  )

  const resultsDropdown = open && results.length > 0 && (
    <ul
      className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-white/[0.06] bg-black/95 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden"
      role="listbox"
      style={{ zIndex: 1001 }}
    >
      {results.map((item, i) => (
        <li key={item.id} role="option" aria-selected={i === activeIdx}>
          <button
            className={`w-full flex items-center gap-2 px-3 py-2.5 min-h-[44px] text-left text-xs transition-colors ${i === activeIdx ? 'bg-amber-500/[0.10] border-l-2 border-amber-500/50' : 'hover:bg-white/[0.04] active:bg-white/[0.06] border-l-2 border-transparent'}`}
            onMouseDown={(e) => {
              e.preventDefault()
              handleSelect(item)
            }}
            onMouseEnter={() => setActiveIdx(i)}
          >
            <span
              className="size-2 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-[9px] uppercase tracking-[0.14em] text-slate-500 shrink-0 w-16">
              {item.category}
            </span>
            <span className="text-slate-100 truncate">{item.name}</span>
            {item.sub && (
              <span className="ml-auto pl-2 text-[10px] text-slate-500 shrink-0 tabular-nums">
                {item.sub}
              </span>
            )}
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
                      placeholder="Search places & layers..."
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value)
                        setOpen(true)
                      }}
                      onFocus={() => setOpen(true)}
                      onKeyDown={handleSearchKeyDown}
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
                {emptyHints}
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
          placeholder="Search places & layers..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleSearchKeyDown}
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-autocomplete="list"
          className="pl-8 pr-12 h-8 text-sm bg-transparent border-none text-white placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-600 bg-white/[0.05] px-1.5 py-0.5 rounded pointer-events-none">
          ⌘K
        </span>
      </div>

      {resultsDropdown}
      {emptyHints}
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
