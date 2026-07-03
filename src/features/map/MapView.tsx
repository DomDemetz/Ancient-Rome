import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/shallow'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { Map as LeafletMap } from 'leaflet'
import { territories } from '@/data'
import { useMapLayerStore } from '@/stores/useMapLayerStore'
import { EntityMarkers } from './overlays/EntityMarkers'
import { TerritoryLayer } from './layers/TerritoryLayer'
import { RoadLayer } from './layers/RoadLayer'
import { SettlementLayer } from './layers/SettlementLayer'
import { LimesLayer } from './layers/LimesLayer'
import { PresenceLayer } from './layers/PresenceLayer'
import { ProvinceLayer } from './layers/ProvinceLayer'
import { FortificationLayer } from './layers/FortificationLayer'
import { WaterLayer } from './layers/WaterLayer'
import { ItinereRoadLayer } from './layers/ItinereRoadLayer'
import { BattleLayer } from './layers/BattleLayer'
import { AmphitheaterLayer } from './layers/AmphitheaterLayer'
import { LegionDeploymentLayer } from './layers/LegionDeploymentLayer'
import { ShipwreckLayer } from './layers/ShipwreckLayer'
import { ResourcesLayer } from './layers/ResourcesLayer'
import { AqueductLayer } from './layers/AqueductLayer'
import { ReligionLayer } from './layers/ReligionLayer'
import { BuildingsLayer } from './layers/BuildingsLayer'
import { PressesLayer } from './layers/PressesLayer'
import { TradeNetworkLayer } from './layers/TradeNetworkLayer'
import { EpigraphyLayer } from './layers/EpigraphyLayer'
import { ViciLayer } from './layers/ViciLayer'
import { PortsLayer } from './layers/PortsLayer'
import { NotablePeopleLayer } from './layers/NotablePeopleLayer'
import { MapControls } from './MapControls'
import { SettlementLegend } from './controls/SettlementLegend'
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

  useEffect(() => {
    if (!pendingFlyTo) return

    const { lat, lng } = pendingFlyTo
    map.flyTo([lat, lng], pendingFlyTo.zoom ?? 9, { duration: 1.2 })
    clearFlyTo()

    // Add a bold highlight ring at the target after the fly animation
    let innerTimer: ReturnType<typeof setTimeout>
    const timer = setTimeout(() => {
      const highlight = L.circleMarker([lat, lng], {
        radius: 22,
        color: '#fff',
        weight: 4,
        fillColor: '#f39c12',
        fillOpacity: 0.25,
        className: 'search-highlight',
      }).addTo(map)

      const inner = L.circleMarker([lat, lng], {
        radius: 10,
        color: '#f39c12',
        weight: 3,
        fill: false,
        className: 'search-highlight',
      }).addTo(map)

      innerTimer = setTimeout(() => {
        highlight.remove()
        inner.remove()
      }, 4000)
    }, 1200)

    return () => {
      clearTimeout(timer)
      clearTimeout(innerTimer)
    }
  }, [pendingFlyTo, map, clearFlyTo])

  return null
}

/** Create custom panes for base polygons below the default overlayPane (z-index 400) */
function BasePane() {
  const map = useMap()
  useEffect(() => {
    // Territory fills live in their own pane held at a fixed group opacity, so
    // the opaque fills composite to translucency once — overlapping era
    // snapshots (during a cross-fade) never darken or wash out.
    if (!map.getPane('territoryFill')) {
      const pane = map.createPane('territoryFill')
      pane.style.zIndex = '240'
      pane.style.opacity = '0.4'
    }
    if (!map.getPane('basePolygons')) {
      const pane = map.createPane('basePolygons')
      pane.style.zIndex = '250'
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

const STADIA_KEY = import.meta.env.VITE_STADIA_API_KEY || ''
const TERRAIN_TILE_URL = `https://tiles.stadiamaps.com/tiles/stamen_terrain_background/{z}/{x}/{y}{r}.png${STADIA_KEY ? `?api_key=${STADIA_KEY}` : ''}`
const BASE_ATTRIBUTION =
  'Map tiles by <a href="https://stamen.com">Stamen Design</a>, hosted by <a href="https://stadiamaps.com">Stadia Maps</a>, under <a href="https://creativecommons.org/licenses/by/4.0">CC BY 4.0</a>. Data by <a href="https://openstreetmap.org">OpenStreetMap</a>' +
  ' | Places: <a href="https://pleiades.stoa.org">Pleiades</a> (CC BY), <a href="https://github.com/AWMC/geodata">AWMC</a> (ODbL), <a href="https://vici.org">Vici.org</a> (CC BY-SA), <a href="https://www.wikidata.org">Wikidata</a> (CC0)'

export function MapView() {
  const [showTerritories, setShowTerritories] = useState(true)
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
    // Open on the Economy preset: roads, streets and trade routes across the
    // full network make the strongest first impression.
    activatePreset('economy')
    // Don't clobber a shared/deep-linked year — useURLSync restores it.
    if (!params.has('year')) setYear(100)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
    showNotablePeople,
    roadsData,
    settlementsData,
    limesData,
    presenceData,
    provincesData,
    provinceLabels,
    provinceChanges,
    fortificationsData,
    waterData,
    itinereRoadsData,
    battlesData,
    amphitheatersData,
    emperorsData,
    legionsData,
    shipwrecksData,
    minesData,
    aqueductsData,
    aqueductLinesData,
    senatorialProvincesData,
    religionData,
    buildingsData,
    pressesData,
    tradeNetworkData,
    epigraphyData,
    viciData,
    portsData,
    notablePeopleData,
    cityPopulationsData,
    settlementTypes,
    hiddenCategories,
    toggleCategory,
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
  let attribution = BASE_ATTRIBUTION
  if (dareActive) attribution += ' | DARE data &copy; Johan &Aring;hlfeldt, CC BY-SA 3.0'
  if (showItinereRoads) attribution += ' | Itiner-e data &copy; Pau de Soto, CC BY-NC 4.0'
  if (showBattles) attribution += ' | Battle data: Roman-Battles-Droid'
  if (showAmphitheaters) attribution += ' | Amphitheater data: roman-amphitheaters'
  if (showShipwrecks) attribution += ' | Shipwreck data: DARMC/OxREP'
  if (showMines) attribution += ' | Mining data: OxREP'
  if (showTradeNetwork) attribution += ' | ORBIS v2 &copy; Stanford University'
  if (showNotablePeople)
    attribution += ' | Notable People: Sciences-Po cross-verified database, CC-BY-SA'

  return (
    <div className="relative w-full h-full flex flex-col" style={{ background: '#0f0a1a' }}>
      <div className="flex-1 relative">
        <MapContainer
          center={ROME_CENTER}
          zoom={DEFAULT_ZOOM}
          style={{ width: '100%', height: '100%', background: '#0f0a1a' }}
          zoomControl={false}
          ref={mapRef}
        >
          <TileLayer
            url={TERRAIN_TILE_URL}
            attribution={attribution}
            errorTileUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg=="
          />
          <BasePane />
          <MapNavHandler />

          {/* Render order: base layers -> overlays -> point layers */}
          {showTerritories && <TerritoryLayer snapshots={territories} />}

          {/* Detailed point/road layers — shown through the data horizon (~800),
              then hidden, where only territory, emperors and battles continue. */}
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

              {showRoads && roadsData && <RoadLayer data={roadsData} />}
              {showItinereRoads && itinereRoadsData && <ItinereRoadLayer data={itinereRoadsData} />}
              {showLimes && limesData && <LimesLayer data={limesData} />}
              {showFortifications && fortificationsData && (
                <FortificationLayer data={fortificationsData} />
              )}

              {showAqueducts && aqueductsData && (
                <AqueductLayer data={aqueductsData} lines={aqueductLinesData} />
              )}
              {showMines && minesData && <ResourcesLayer data={minesData} />}
              {showPresses && pressesData && <PressesLayer data={pressesData} />}
              {showEpigraphy && epigraphyData && <EpigraphyLayer data={epigraphyData} />}
              {showTradeNetwork && tradeNetworkData && (
                <TradeNetworkLayer data={tradeNetworkData} />
              )}
              {showShipwrecks && shipwrecksData && <ShipwreckLayer data={shipwrecksData} />}
              {showReligion && religionData && <ReligionLayer data={religionData} />}
              {showBuildings && buildingsData && <BuildingsLayer data={buildingsData} />}
              {showPorts && portsData && (
                <PortsLayer data={portsData as Parameters<typeof PortsLayer>[0]['data']} />
              )}
              {showVici && viciData && (
                <ViciLayer data={viciData as Parameters<typeof ViciLayer>[0]['data']} />
              )}
              {showAmphitheaters && amphitheatersData && (
                <AmphitheaterLayer data={amphitheatersData} />
              )}
              {showSettlements && settlementsData && (
                <SettlementLayer
                  data={settlementsData}
                  enabledTypes={enabledTypes}
                  hiddenCategories={hiddenCategories}
                  populationData={cityPopulationsData}
                />
              )}
              {showLegions && legionsData && <LegionDeploymentLayer data={legionsData} />}
              {showNotablePeople && notablePeopleData && (
                <NotablePeopleLayer data={notablePeopleData} />
              )}

              <EntityMarkers />
            </>
          )}

          {/* Battles render in every era — the Byzantine centuries have their
              own pivotal sieges (Constantinople 674, 717, 1204, 1453; Manzikert). */}
          {showBattles && battlesData && <BattleLayer data={battlesData} />}
        </MapContainer>

        <MapControls
          showTerritories={showTerritories}
          onToggleTerritories={() => setShowTerritories((v) => !v)}
          mapRef={mapRef}
        />

        {showSettlements && (
          <SettlementLegend hiddenCategories={hiddenCategories} onToggleCategory={toggleCategory} />
        )}

        {showEmperors && emperorsData && <EmperorBanner emperors={emperorsData} />}

        <StatsOverlay />
        <LayerErrorToast />
      </div>

      <TimelinePlayer />
    </div>
  )
}
