import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/shallow'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { Map as LeafletMap } from 'leaflet'
import { territories } from '@/data'
import { useMapLayerStore } from '@/stores/useMapLayerStore'
import { EntityMarkers } from './EntityMarkers'
import { TerritoryLayer } from './TerritoryLayer'
import { RoadLayer } from './RoadLayer'
import { SettlementLayer } from './SettlementLayer'
import { LimesLayer } from './LimesLayer'
import { PresenceLayer } from './PresenceLayer'
import { ProvinceLayer } from './ProvinceLayer'
import { FortificationLayer } from './FortificationLayer'
import { WaterLayer } from './WaterLayer'
import { ItinereRoadLayer } from './ItinereRoadLayer'
import { BattleLayer } from './BattleLayer'
import { AmphitheaterLayer } from './AmphitheaterLayer'
import { LegionDeploymentLayer } from './LegionDeploymentLayer'
import { ShipwreckLayer } from './ShipwreckLayer'
import { ResourcesLayer } from './ResourcesLayer'
import { AqueductLayer } from './AqueductLayer'
import { ReligionLayer } from './ReligionLayer'
import { BuildingsLayer } from './BuildingsLayer'
import { PressesLayer } from './PressesLayer'
import { TradeNetworkLayer } from './TradeNetworkLayer'
import { EpigraphyLayer } from './EpigraphyLayer'
import { ViciLayer } from './ViciLayer'
import { PortsLayer } from './PortsLayer'
import { MapControls } from './MapControls'
import { SettlementLegend } from './SettlementLegend'
import { EmperorBanner } from './EmperorBanner'
import { StatsOverlay } from './StatsOverlay'
import { StorySelector } from './StorySelector'
import { StoryPlayer } from './StoryPlayer'
import type { Story } from './StoryPlayer'
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

/** Create a custom pane for territory/province polygons below the default overlayPane (z-index 400) */
function BasePane() {
  const map = useMap()
  useEffect(() => {
    if (!map.getPane('basePolygons')) {
      const pane = map.createPane('basePolygons')
      pane.style.zIndex = '250'
    }
  }, [map])
  return null
}

const ROME_CENTER: [number, number] = [41.9, 12.5]
const DEFAULT_ZOOM = 5

const STADIA_KEY = import.meta.env.VITE_STADIA_API_KEY || ''
const TERRAIN_TILE_URL = `https://tiles.stadiamaps.com/tiles/stamen_terrain_background/{z}/{x}/{y}{r}.png${STADIA_KEY ? `?api_key=${STADIA_KEY}` : ''}`
const BASE_ATTRIBUTION =
  'Map tiles by <a href="https://stamen.com">Stamen Design</a>, hosted by <a href="https://stadiamaps.com">Stadia Maps</a>, under <a href="https://creativecommons.org/licenses/by/4.0">CC BY 4.0</a>. Data by <a href="https://openstreetmap.org">OpenStreetMap</a>'

export function MapView() {
  const [showTerritories, setShowTerritories] = useState(true)
  const [activeStory, setActiveStory] = useState<Story | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)

  // Smart default: open with Conquest preset at 100 AD with brief autoplay
  const initRef = useRef(false)
  const { activatePreset } = useMapLayerStore()
  const { setYear } = useTimelineStore()
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    // Skip if story param in URL
    if (new URLSearchParams(window.location.search).has('story')) return
    activatePreset('conquest')
    setYear(100)
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

  const handleStoryNavigate = useCallback((center: [number, number], zoom: number) => {
    if (mapRef.current) {
      mapRef.current.flyTo(center, zoom, { duration: 1.5 })
    }
  }, [])

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
          <TileLayer url={TERRAIN_TILE_URL} attribution={attribution} />
          <BasePane />
          <MapNavHandler />

          {/* Render order: base layers -> overlays -> point layers */}
          {showTerritories && <TerritoryLayer snapshots={territories} />}
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
          {showTradeNetwork && tradeNetworkData && <TradeNetworkLayer data={tradeNetworkData} />}
          {showShipwrecks && shipwrecksData && <ShipwreckLayer data={shipwrecksData} />}
          {showReligion && religionData && <ReligionLayer data={religionData} />}
          {showBuildings && buildingsData && <BuildingsLayer data={buildingsData} />}
          {showPorts && portsData && (
            <PortsLayer data={portsData as Parameters<typeof PortsLayer>[0]['data']} />
          )}
          {showVici && viciData && (
            <ViciLayer data={viciData as Parameters<typeof ViciLayer>[0]['data']} />
          )}
          {showAmphitheaters && amphitheatersData && <AmphitheaterLayer data={amphitheatersData} />}
          {showSettlements && settlementsData && (
            <SettlementLayer
              data={settlementsData}
              enabledTypes={enabledTypes}
              hiddenCategories={hiddenCategories}
              populationData={cityPopulationsData}
            />
          )}
          {showLegions && legionsData && <LegionDeploymentLayer data={legionsData} />}
          {showBattles && battlesData && <BattleLayer data={battlesData} />}

          <EntityMarkers />
        </MapContainer>

        <MapControls
          showTerritories={showTerritories}
          onToggleTerritories={() => setShowTerritories((v) => !v)}
          mapRef={mapRef}
        />

        {showSettlements && !activeStory && (
          <SettlementLegend hiddenCategories={hiddenCategories} onToggleCategory={toggleCategory} />
        )}

        {showEmperors && emperorsData && <EmperorBanner emperors={emperorsData} />}

        <StatsOverlay />

        {/* Story system */}
        {!activeStory && <StorySelector onSelect={setActiveStory} />}
        {activeStory && (
          <StoryPlayer
            story={activeStory}
            onClose={() => setActiveStory(null)}
            onNavigate={handleStoryNavigate}
          />
        )}
      </div>

      <TimelinePlayer />
    </div>
  )
}
