import { GeoJSON } from 'react-leaflet'
import { useTimelineStore } from '@/stores/useTimelineStore'
import type { TerritorySnapshot } from '@/types'

interface TerritoryLayerProps {
  snapshots: TerritorySnapshot[]
}

// Map status values to fill colors
const STATUS_COLORS: Record<string, string> = {
  controlled: '#c0392b',
  allied: '#e89040',
  contested: '#f1c40f',
  lost: '#7f8c8d',
  core: '#c0392b',
  province: '#e74c3c',
  client: '#e89040',
}

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? '#888888'
}

export function TerritoryLayer({ snapshots }: TerritoryLayerProps) {
  const currentYear = useTimelineStore((s) => s.currentYear)

  // Find all snapshots with year <= currentYear
  const eligible = snapshots.filter((s) => s.year <= currentYear)
  if (eligible.length === 0) return null

  // Group by territory id, pick the latest (closest to currentYear) per id
  const latestByRegion = new Map<string, TerritorySnapshot>()
  for (const snap of eligible) {
    const existing = latestByRegion.get(snap.id)
    if (!existing || snap.year > existing.year) {
      latestByRegion.set(snap.id, snap)
    }
  }

  const activeSnapshots = Array.from(latestByRegion.values())

  return (
    <>
      {activeSnapshots.map((snap) => {
        if (!snap.boundaries) return null
        const color = getStatusColor(snap.status)

        return (
          <GeoJSON
            key={`${snap.id}-${snap.year}-${currentYear}`}
            data={snap.boundaries}
            interactive={false}
            pane="basePolygons"
            style={{
              color: '#fff',
              fillColor: color,
              fillOpacity: snap.year >= -300 ? 0.35 : 0.5,
              weight: 1.5,
              opacity: 0.5,
              pane: 'basePolygons',
            }}
          />
        )
      })}
    </>
  )
}
