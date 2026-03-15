import L from 'leaflet'
import { Marker, Popup } from 'react-leaflet'
import { useShallow } from 'zustand/shallow'
import { entities } from '@/data'
import { useFilterStore } from '@/stores/useFilterStore'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { filterEntities } from '@/lib/filtering'
import { entityColors } from '@/lib/colors'
import type { Entity } from '@/types'

function createDotIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: ${color};
      border: 1.5px solid rgba(255,255,255,0.6);
      box-shadow: 0 0 4px rgba(0,0,0,0.5);
    "></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
    popupAnchor: [0, -8],
  })
}

function isLocationWithCoords(entity: Entity): entity is Extract<
  Entity,
  { entityType: 'location' }
> & {
  coordinates: { lat: number; lng: number }
} {
  return entity.entityType === 'location' && entity.coordinates !== undefined
}

export function EntityMarkers() {
  const filters = useFilterStore(
    useShallow((s) => ({
      entityTypes: s.entityTypes,
      connectionTypes: s.connectionTypes,
      regions: s.regions,
      yearRange: s.yearRange,
      searchQuery: s.searchQuery,
    })),
  )

  const select = useSelectionStore((s) => s.select)

  const filteredEntities = filterEntities(entities, filters)
  const locationEntities = filteredEntities.filter(isLocationWithCoords)

  return (
    <>
      {locationEntities.map((entity) => {
        const color = entityColors[entity.entityType]
        const icon = createDotIcon(color)
        const description =
          entity.description.length > 120
            ? entity.description.slice(0, 120) + '…'
            : entity.description

        return (
          <Marker
            key={entity.id}
            position={[entity.coordinates!.lat, entity.coordinates!.lng]}
            icon={icon}
            eventHandlers={{
              click: () => select(entity.id),
            }}
          >
            <Popup>
              <div style={{ minWidth: 160, maxWidth: 220 }}>
                <strong style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>
                  {entity.name}
                </strong>
                <span style={{ fontSize: 11, color: '#888' }}>{description}</span>
              </div>
            </Popup>
          </Marker>
        )
      })}
    </>
  )
}
