import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/shallow'
import { MapContainer, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { Map as LeafletMap } from 'leaflet'
import { loadTerritories } from '@/data'
import type { TerritorySnapshot } from '@/types'
import { ALL_LAYER_KEYS, useMapLayerStore, getPersistedLayers } from '@/stores/useMapLayerStore'
import { TerritoryLayer } from './layers/TerritoryLayer'
import { EmpiresLayer } from './layers/EmpiresLayer'
import { SeaLabels } from './layers/SeaLabels'
import { MonumentLabels } from './overlays/MonumentLabels'
import { RoadLayer } from './layers/RoadLayer'
import { PlacesLayer } from './layers/PlacesLayer'
import { LimesLayer } from './layers/LimesLayer'
import { IslamicConquestsLayer } from './layers/IslamicConquestsLayer'
import { PresenceLayer } from './layers/PresenceLayer'
import { ProvinceLayer } from './layers/ProvinceLayer'
import { FortificationLayer } from './layers/FortificationLayer'
import { WaterLayer } from './layers/WaterLayer'
import { ItinereRoadLayer } from './layers/ItinereRoadLayer'
import { BattleLayer } from './layers/BattleLayer'
import { LegionDeploymentLayer } from './layers/LegionDeploymentLayer'
import { AqueductLayer } from './layers/AqueductLayer'
import { TradeNetworkLayer } from './layers/TradeNetworkLayer'
import { EpigraphyLayer } from './layers/EpigraphyLayer'
import { NotablePeopleLayer } from './layers/NotablePeopleLayer'
import { AtlasLayer } from './layers/AtlasLayer'
import { DATASET_REGISTRY } from '@/data/datasetRegistry'
import { BASE_SOURCES, type AttributionKey } from '@/lib/attribution'
import { MapControls } from './MapControls'
import { SitesLegend } from './controls/SettlementLegend'
import { EmperorBanner } from './controls/EmperorBanner'
import { StatsOverlay } from './controls/StatsOverlay'
import { TimelinePlayer } from '@/features/timeline/TimelinePlayer'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useMapNavStore } from '@/stores/useMapNavStore'

/** Listens for flyTo requests from the global nav store and highlights the target */
function MapNavHandler() {
  const map = useMap()
  const pendingFlyTo = useMapNavStore((s) => s.pendingFlyTo)
  const clearFlyTo = useMapNavStore((s) => s.clearFlyTo)
  const setMapView = useMapNavStore((s) => s.setMapView)

  useEffect(() => {
    const handler = () => {
      const c = map.getCenter()
      setMapView(c.lat, c.lng, map.getZoom())
    }
    map.on('moveend', handler)
    handler()
    return () => {
      map.off('moveend', handler)
    }
  }, [map, setMapView])

  // Attribution anchors are raw HTML from composed strings — stamp
  // target=_blank at click time so credits never navigate the app away
  useEffect(() => {
    const container = map.getContainer()
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest?.('.leaflet-control-attribution a')
      if (a instanceof HTMLAnchorElement) {
        a.target = '_blank'
        a.rel = 'noopener noreferrer'
      }
    }
    container.addEventListener('click', onClick, true)
    return () => container.removeEventListener('click', onClick, true)
  }, [map])

  // Highlight cleanup lives in a ref, NOT in the effect's return: clearFlyTo()
  // below nulls pendingFlyTo and re-runs the effect, so a returned cleanup
  // would cancel the highlight timer before the ring ever appears.
  const highlightCleanup = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!pendingFlyTo) return

    const { lat, lng } = pendingFlyTo
    map.flyTo([lat, lng], pendingFlyTo.zoom ?? 9, { duration: 1.2 })
    clearFlyTo()

    // Remove any highlight still pending from a previous search
    highlightCleanup.current?.()

    // Add a ring around the target after the fly animation. 8s, not 4:
    // arrivals read the record panel first, and the ring was gone before
    // their eyes came back to the map.
    let ring: L.CircleMarker | undefined
    let removeTimer: ReturnType<typeof setTimeout> | undefined
    const timer = setTimeout(() => {
      ring = L.circleMarker([lat, lng], {
        radius: 14,
        color: '#f39c12',
        weight: 2.5,
        fill: false,
        interactive: false,
      }).addTo(map)

      removeTimer = setTimeout(() => ring?.remove(), 8000)
    }, 1200)

    highlightCleanup.current = () => {
      clearTimeout(timer)
      if (removeTimer) clearTimeout(removeTimer)
      ring?.remove()
    }
  }, [pendingFlyTo, map, clearFlyTo])

  // Remove the highlight if the map unmounts (e.g. lens switch)
  useEffect(() => () => highlightCleanup.current?.(), [])

  return null
}

/** Create custom panes for base polygons below the default overlayPane (z-index 400) */
function BasePane() {
  const map = useMap()
  useEffect(() => {
    // Territory fills live in their own pane held at a fixed group opacity, so
    // the opaque fills composite to translucency once — overlapping era
    // snapshots (during a cross-fade) never darken or wash out.
    if (!map.getPane('empiresFill')) {
      // World polities live beneath Rome's own territory
      const pane = map.createPane('empiresFill')
      pane.style.zIndex = '235'
      pane.style.opacity = '0.55'
    }
    if (!map.getPane('territoryFill')) {
      const pane = map.createPane('territoryFill')
      pane.style.zIndex = '240'
      pane.style.opacity = '0.55'
    }
    if (!map.getPane('basePolygons')) {
      const pane = map.createPane('basePolygons')
      pane.style.zIndex = '250'
    }

    // At city zooms the political wash stops informing (one polity fills the
    // whole viewport) and starts hiding the terrain, monuments, and street-
    // level texture — ease it back from atlas strength to a tint. Kept above
    // zero so the fill still veils the modern urban footprint baked into the
    // raster tiles.
    const FULL = 0.55
    const TINT = 0.3
    for (const name of ['empiresFill', 'territoryFill']) {
      const pane = map.getPane(name)
      if (pane) pane.style.transition = 'opacity 400ms ease'
    }
    const applyZoomFade = () => {
      const z = map.getZoom()
      // 0.55 flat through z7, linear ramp down, 0.3 floor from z10
      const t = Math.min(1, Math.max(0, (z - 7) / 3))
      const opacity = String(FULL - (FULL - TINT) * t)
      for (const name of ['empiresFill', 'territoryFill']) {
        const pane = map.getPane(name)
        if (pane) pane.style.opacity = opacity
      }
    }
    applyZoomFade()
    map.on('zoomend', applyZoomFade)
    return () => {
      map.off('zoomend', applyZoomFade)
    }
  }, [map])
  return null
}

/** Toast notification for layer load errors — auto-dismisses after 4s */
function LayerErrorToast() {
  const loadError = useMapLayerStore((s) => s.loadError)
  const dismissError = useMapLayerStore((s) => s.dismissError)

  useEffect(() => {
    if (!loadError) return
    const timer = setTimeout(dismissError, 4000)
    return () => clearTimeout(timer)
  }, [loadError, dismissError])

  if (!loadError) return null

  return (
    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto">
      <div className="flex items-center gap-2 rounded-lg bg-red-950/90 border border-red-500/20 px-4 py-2 text-xs text-red-200 shadow-lg backdrop-blur-md">
        <span>{loadError}</span>
        <button onClick={dismissError} className="text-red-400 hover:text-red-200 ml-1">
          &times;
        </button>
      </div>
    </div>
  )
}

const ROME_CENTER: [number, number] = [41.9, 12.5]
const DEFAULT_ZOOM = 5

// Fat-finger pass (phones only). Two problems with canvas hit-testing:
// 1) taps a few px off a small dot miss it — widen every hit-test by 8px;
// 2) Leaflet fires the LAST-DRAWN hit, and road layers remount (redraw) on
//    every timeline change, landing above the dots — so tapping Rome's dot
//    opened a ROAD popup. Patch _onClick to prefer circle markers over
//    line hits. Private API (leaflet 1.9 is frozen); revisit on upgrade.
if (L.Browser.mobile) {
  L.Canvas.prototype.options.tolerance = 8
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const proto = L.Canvas.prototype as any
  const origOnClick = proto._onClick
  proto._onClick = function (e: MouseEvent) {
    const point = this._map.mouseEventToLayerPoint(e)
    let dot: any = null
    for (let order = this._drawFirst; order; order = order.next) {
      const layer = order.layer
      if (
        layer instanceof L.CircleMarker &&
        layer.options.interactive &&
        (layer as any)._containsPoint(point) &&
        !this._map._draggableMoved(layer)
      ) {
        dot = layer
      }
    }
    if (dot) this._fireEvent([dot], e)
    else origOnClick.call(this, e)
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

const STADIA_KEY = import.meta.env.VITE_STADIA_API_KEY || ''
const TERRAIN_TILE_URL = `https://tiles.stadiamaps.com/tiles/stamen_terrain_background/{z}/{x}/{y}{r}.png${STADIA_KEY ? `?api_key=${STADIA_KEY}` : ''}`
const BASE_ATTRIBUTION =
  'Map tiles by <a href="https://stamen.com">Stamen Design</a>, hosted by <a href="https://stadiamaps.com">Stadia Maps</a>, under <a href="https://creativecommons.org/licenses/by/4.0">CC BY 4.0</a>. Data by <a href="https://openstreetmap.org">OpenStreetMap</a>' +
  ' | Places: <a href="https://pleiades.stoa.org">Pleiades</a> (CC BY), <a href="https://github.com/AWMC/geodata">AWMC</a> (ODbL), <a href="https://vici.org">Vici.org</a> (CC BY-SA), <a href="https://www.wikidata.org">Wikidata</a> (CC0)'

/** Terrain tiles, tuned so phone panning never reveals bare squares:
 *  - updateWhenIdle=false: Leaflet's mobile default postpones ALL tile
 *    requests until the pan gesture ends — tiles now stream in mid-pan
 *  - keepBuffer=6: retain a wide ring of already-seen tiles
 *  - on mobile, an edge buffer (leaflet-edgebuffer pattern) pads the
 *    tile-fetch bounds by one tile, so the ring past the phone's border
 *    is ALREADY loaded when the pan reveals it. Desktop skips the pad —
 *    a 1680px viewport already shows the world, and it would double the
 *    Stadia quota for nothing. */
const EdgeBufferedTileLayer = L.TileLayer.extend({
  _getTiledPixelBounds(center: L.LatLng): L.Bounds {
    const proto = L.TileLayer.prototype as unknown as {
      _getTiledPixelBounds: (c: L.LatLng) => L.Bounds
    }
    const b = proto._getTiledPixelBounds.call(this, center)
    // two tile-rings past the border: one ring evaporated on a fast swipe
    // and the pop-in stayed visible; three rings cost ~180 tiles (~4MB)
    // on first load — too much cellular tax for the last few px of swipe
    const pad = L.Browser.mobile ? 512 : 0
    return new L.Bounds(b.min!.subtract([pad, pad]), b.max!.add([pad, pad]))
  },
}) as unknown as new (url: string, options?: L.TileLayerOptions) => L.TileLayer

function TerrainTiles({ attribution }: { attribution: string }) {
  const map = useMap()
  useEffect(() => {
    const layer = new EdgeBufferedTileLayer(TERRAIN_TILE_URL, {
      updateWhenIdle: false,
      updateInterval: 80, // default 200ms lagged behind fast swipes
      keepBuffer: 8,
      errorTileUrl:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==',
    })
    layer.addTo(map)
    return () => {
      map.removeLayer(layer)
    }
  }, [map])
  // attribution is layer-dependent (DARE/ORBIS/... credits join as layers
  // toggle) — sync it like react-leaflet's <TileLayer attribution> did
  useEffect(() => {
    map.attributionControl?.addAttribution(attribution)
    return () => {
      map.attributionControl?.removeAttribution(attribution)
    }
  }, [map, attribution])
  return null
}

export function MapView() {
  const [showTerritories, setShowTerritories] = useState(true)
  // lazy: 3.8 MB that first paint shouldn't wait for
  const [territories, setTerritories] = useState<TerritorySnapshot[] | null>(null)
  useEffect(() => {
    loadTerritories().then(setTerritories)
  }, [])
  const mapRef = useRef<LeafletMap | null>(null)

  // Smart default: open with Conquest preset at 100 AD with brief autoplay
  const initRef = useRef(false)
  const { activatePreset } = useMapLayerStore()
  const { setYear } = useTimelineStore()
  // How far the detailed layers run. The temporally-enriched networks (roads and
  // ORBIS trade) and the settlement data genuinely persist past 476 — settlements
  // to ~800, and ~60% of road/trade segments never decline. So run the full detail
  // through the settlement horizon (~800, Charlemagne's coronation — where the
  // archaeological data finally runs out); past that, territory, emperors and
  // battles carry the story. Boolean selector → re-renders only on threshold cross.
  const detailEra = useTimelineStore((s) => s.currentYear <= 800)
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    const params = new URLSearchParams(window.location.search)
    // Skip if story param in URL
    if (params.has('story')) return
    // A shared link carries its scene: ?layers=empires,cities (+ ?ds=temples)
    // overrides the visitor's own persisted set — the sender's 1223 world
    // mosaic must not open as the recipient's Roman-roads default.
    if (params.has('layers')) {
      const wanted = new Set(
        (params.get('layers') ?? '')
          .split(',')
          .filter(Boolean)
          .map((n) => `show${n.charAt(0).toUpperCase()}${n.slice(1)}`),
      )
      // names arrive lowercased — match case-insensitively against real keys
      const byLower = new Map(ALL_LAYER_KEYS.map((k) => [k.toLowerCase(), k]))
      const keys = [...wanted]
        .map((k) => byLower.get(k.toLowerCase()))
        .filter((k): k is (typeof ALL_LAYER_KEYS)[number] => k != null)
      useMapLayerStore.getState().setLayers(keys)
      for (const id of (params.get('ds') ?? '').split(',').filter(Boolean)) {
        const st = useMapLayerStore.getState().datasetState[id]
        if (st && !st.show) useMapLayerStore.getState().toggleDataset(id)
      }
    } else {
      // A returning visitor gets their own layer selection back; first-timers
      // open on the Economy preset (strongest first impression).
      const saved = getPersistedLayers()
      if (saved && saved.length > 0) {
        useMapLayerStore.getState().setLayers(saved)
      } else {
        activatePreset('economy')
      }
    }
    // Don't clobber a shared/deep-linked year — useURLSync restores it.
    if (!params.has('year')) setYear(100)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const {
    showRoads,
    showSettlements,
    showCities,
    showEmpires,
    empiresData,
    showLimes,
    showIslamicConquests,
    showPresence,
    showProvinces,
    showFortifications,
    showWater,
    showItinereRoads,
    showBattles,
    showEmperors,
    showLegions,
    showAqueducts,
    showTradeNetwork,
    showEpigraphy,
    showNotablePeople,
    roadsData,
    placesData,
    limesData,
    islamicConquestsData,
    presenceData,
    provincesData,
    provinceLabels,
    provinceChanges,
    fortificationsData,
    waterData,
    itinereRoadsData,
    battlesData,
    emperorsData,
    legionsData,
    aqueductLinesData,
    senatorialProvincesData,
    tradeNetworkData,
    epigraphyData,
    notablePeopleData,
    settlementTypes,
    hiddenCategories,
    datasetState,
  } = useMapLayerStore(useShallow((s) => s))

  const enabledTypes = useMemo(() => {
    const set = new Set<number>()
    for (const [k, v] of Object.entries(settlementTypes)) {
      if (v) set.add(Number(k))
    }
    return set
  }, [settlementTypes])

  // Build attribution dynamically
  const dareActive =
    showRoads ||
    showSettlements ||
    showLimes ||
    showPresence ||
    showProvinces ||
    showFortifications ||
    showWater
  // attribution strings live in ONE ledger (lib/attribution.ts)
  const active: AttributionKey[] = []
  if (showEmpires) active.push('empires')
  if (dareActive) active.push('dare')
  if (showItinereRoads) active.push('itinere')
  if (showBattles) active.push('battles')
  if (showProvinces) active.push('provinces')
  if (showIslamicConquests) active.push('conquests')
  if (showTradeNetwork) active.push('orbis')
  if (showNotablePeople) active.push('people')
  if (DATASET_REGISTRY.some((cfg) => datasetState[cfg.id]?.show)) active.push('sites')
  const attribution = [BASE_ATTRIBUTION, ...active.map((k) => BASE_SOURCES[k])].join(' | ')

  return (
    <div className="relative w-full h-full flex flex-col" style={{ background: '#0f0a1a' }}>
      <div className="flex-1 relative">
        <MapContainer
          center={ROME_CENTER}
          zoom={DEFAULT_ZOOM}
          // Background = the tiles' post-filter sea tone, NOT house dark: this
          // color is what shows wherever a pan outruns tile loading (fast
          // multi-swipe on cellular), and open sea is invisible pop-in — the
          // house-dark boot frame stays on the wrapper div above.
          style={{ width: '100%', height: '100%', background: '#40566a' }}
          zoomControl={false}
          preferCanvas
          // no 200ms tile fade on phones: with the edge buffer the tiles are
          // usually READY — the fade itself was the visible "loading" feel
          fadeAnimation={!L.Browser.mobile}
          ref={mapRef}
        >
          <TerrainTiles attribution={attribution} />
          <BasePane />
          <MapNavHandler />

          {/* Render order: base layers -> overlays -> point layers */}
          {/* The world's polities (Cliopatria/Seshat, CC BY 4.0) — beneath Rome */}
          {showEmpires && empiresData && <EmpiresLayer data={empiresData} />}
          {showTerritories && territories && <TerritoryLayer snapshots={territories} />}
          <SeaLabels />
          {/* famous-site names at z>=10 — the overlay self-gates by zoom and
              only labels types whose dot layer is actually on */}
          <MonumentLabels />

          {/* Base layers — every record is date-bounded and self-filters (start/
              end or attested/decline years), so they render across the WHOLE
              timeline, each only within its own years. This is the "places &
              networks over time" base; territory is the empire overlay on top.
              Nothing dateless can appear, so none of it pops up at the wrong era. */}
          {showRoads && roadsData && <RoadLayer data={roadsData} />}
          {showItinereRoads && itinereRoadsData && <ItinereRoadLayer data={itinereRoadsData} />}
          {showTradeNetwork && tradeNetworkData && (
            <TradeNetworkLayer data={tradeNetworkData} placesOn={showSettlements || showCities} />
          )}

          {/* THE canonical place layer — one node per real place, merged from
              DARE + Chandler + Pleiades + Wikidata (ENTITY-MODEL.md). Renders
              across ALL eras; every node is date-bounded, population nodes are
              labeled and sized, DARE-typed nodes keep the category legend. */}
          {(showSettlements || showCities) && placesData && (
            <PlacesLayer
              data={placesData}
              enabledTypes={enabledTypes}
              hiddenCategories={hiddenCategories}
              showSettlements={showSettlements}
              showCities={showCities}
            />
          )}

          {/* Roman-scoped layers — institutions & enrichment with no post-antiquity
              data. Gated at the detail horizon; nothing here reaches the Middle Ages. */}
          {detailEra && (
            <>
              {showProvinces && provincesData && (
                <ProvinceLayer
                  data={provincesData}
                  labels={provinceLabels ?? undefined}
                  changes={provinceChanges ?? undefined}
                  senatorialProvinces={senatorialProvincesData}
                />
              )}
              {showWater && waterData && <WaterLayer data={waterData} />}
              {showPresence && presenceData && <PresenceLayer data={presenceData} />}
              {showLimes && limesData && <LimesLayer data={limesData} />}
              {showIslamicConquests && islamicConquestsData && (
                <IslamicConquestsLayer data={islamicConquestsData} />
              )}
              {showFortifications && fortificationsData && (
                <FortificationLayer data={fortificationsData} />
              )}
              {showAqueducts && <AqueductLayer lines={aqueductLinesData} />}
              {showEpigraphy && epigraphyData && <EpigraphyLayer data={epigraphyData} />}
              {showLegions && legionsData && <LegionDeploymentLayer data={legionsData} />}
              {showNotablePeople && notablePeopleData && (
                <NotablePeopleLayer data={notablePeopleData} />
              )}
            </>
          )}

          {/* THE entity atlas — every point-entity category through the one
              renderer; one dot per real-world entity (unified rework) */}
          {DATASET_REGISTRY.filter((cfg) => {
            const ds = datasetState[cfg.id]
            return ds?.show && ds.data
          }).map((cfg) => (
            <AtlasLayer key={cfg.id} data={datasetState[cfg.id].data!} config={cfg} />
          ))}

          {/* Battles render in every era — the Byzantine centuries have their
              own pivotal sieges (Constantinople 674, 717, 1204, 1453; Manzikert). */}
          {showBattles && battlesData && <BattleLayer data={battlesData} />}
        </MapContainer>

        {/* atlas-plate vignette: sits over the map, under the UI */}
        <div className="map-vignette" aria-hidden />

        <MapControls
          showTerritories={showTerritories}
          onToggleTerritories={() => setShowTerritories((v) => !v)}
          mapRef={mapRef}
        />

        {DATASET_REGISTRY.some((cfg) => datasetState[cfg.id]?.show) && <SitesLegend />}

        {showEmperors && emperorsData && <EmperorBanner emperors={emperorsData} />}

        <StatsOverlay />
        <LayerErrorToast />
      </div>

      <TimelinePlayer />
    </div>
  )
}
