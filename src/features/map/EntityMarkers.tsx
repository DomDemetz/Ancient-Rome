import { useMemo } from 'react'
import L from 'leaflet'
import { Marker } from 'react-leaflet'
import { useShallow } from 'zustand/shallow'
import { entities } from '@/data'
import { useFilterStore } from '@/stores/useFilterStore'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { filterEntities } from '@/lib/filtering'
import { entityColors } from '@/lib/colors'
import type { Entity } from '@/types'

const iconCache = new Map<string, L.DivIcon>()

function getDotIcon(color: string): L.DivIcon {
  let icon = iconCache.get(color)
  if (!icon) {
    icon = L.divIcon({
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
    iconCache.set(color, icon)
  }
  return icon
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
    })),
  )

  const select = useSelectionStore((s) => s.select)
  const currentYear = useTimelineStore((s) => s.currentYear)

  const locationEntities = useMemo(() => {
    return filterEntities(entities, filters, currentYear).filter(isLocationWithCoords)
  }, [filters, currentYear])

  return (
    <>
      {locationEntities.map((entity) => {
        const color = entityColors[entity.entityType]
        const icon = getDotIcon(color)

        return (
          <Marker
            key={entity.id}
            position={[entity.coordinates!.lat, entity.coordinates!.lng]}
            icon={icon}
            eventHandlers={{
              click: () => select(entity.id),
            }}
          />
        )
      })}
    </>
  )
}
