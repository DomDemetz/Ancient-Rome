import 'leaflet/dist/leaflet.css'
import { useCallback, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer } from 'react-leaflet'
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
import { MapControls } from './MapControls'
import { SettlementLegend } from './SettlementLegend'
import { EmperorBanner } from './EmperorBanner'
import { StorySelector } from './StorySelector'
import { StoryPlayer } from './StoryPlayer'
import type { Story } from './StoryPlayer'
import { TimelinePlayer } from '@/features/timeline/TimelinePlayer'

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
    roadsData,
    settlementsData,
    limesData,
    presenceData,
    provincesData,
    provinceLabels,
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
    religionData,
    buildingsData,
    pressesData,
    tradeNetworkData,
    epigraphyData,
    cityPopulationsData,
    settlementTypes,
    hiddenCategories,
    toggleCategory,
  } = store

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
          zoomControl={true}
          ref={mapRef}
        >
          <TileLayer url={TERRAIN_TILE_URL} attribution={attribution} />

          {/* Render order: base layers -> overlays -> point layers */}
          {showWater && waterData && <WaterLayer data={waterData} />}
          {showPresence && presenceData && <PresenceLayer data={presenceData} />}
          {showProvinces && provincesData && (
            <ProvinceLayer data={provincesData} labels={provinceLabels ?? undefined} />
          )}
          {showTerritories && <TerritoryLayer snapshots={territories} />}

          {showRoads && roadsData && <RoadLayer data={roadsData} />}
          {showItinereRoads && itinereRoadsData && <ItinereRoadLayer data={itinereRoadsData} />}
          {showLimes && limesData && <LimesLayer data={limesData} />}
          {showFortifications && fortificationsData && (
            <FortificationLayer data={fortificationsData} />
          )}

          {showAqueducts && aqueductsData && <AqueductLayer data={aqueductsData} />}
          {showMines && minesData && <ResourcesLayer data={minesData} />}
          {showPresses && pressesData && <PressesLayer data={pressesData} />}
          {showEpigraphy && epigraphyData && <EpigraphyLayer data={epigraphyData} />}
          {showTradeNetwork && tradeNetworkData && <TradeNetworkLayer data={tradeNetworkData} />}
          {showShipwrecks && shipwrecksData && <ShipwreckLayer data={shipwrecksData} />}
          {showReligion && religionData && <ReligionLayer data={religionData} />}
          {showBuildings && buildingsData && <BuildingsLayer data={buildingsData} />}
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
        />

        {showSettlements && (
          <SettlementLegend hiddenCategories={hiddenCategories} onToggleCategory={toggleCategory} />
        )}

        {showEmperors && emperorsData && <EmperorBanner emperors={emperorsData} />}

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
