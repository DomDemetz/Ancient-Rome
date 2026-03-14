import { useMemo } from 'react'
import { entities, connections } from '@/data'
import { entityColors, entityLabels } from '@/lib/colors'
import type { Entity } from '@/types'

const ENTITY_TYPES = Object.keys(entityLabels) as Entity['entityType'][]

export function SummaryCards() {
  const counts = useMemo(() => {
    const byType = new Map<Entity['entityType'], number>()
    for (const type of ENTITY_TYPES) {
      byType.set(type, 0)
    }
    for (const e of entities) {
      byType.set(e.entityType, (byType.get(e.entityType) ?? 0) + 1)
    }
    return byType
  }, [])

  return (
    <div className="space-y-4">
      {/* Totals row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-bg-card p-4">
          <p className="text-xs text-text-secondary uppercase tracking-wide mb-1">Total Entities</p>
          <p className="text-2xl font-bold text-text-primary">{entities.length.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-bg-card p-4">
          <p className="text-xs text-text-secondary uppercase tracking-wide mb-1">
            Total Connections
          </p>
          <p className="text-2xl font-bold text-text-primary">
            {connections.length.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-bg-card p-4 col-span-2 sm:col-span-1">
          <p className="text-xs text-text-secondary uppercase tracking-wide mb-1">Entity Types</p>
          <p className="text-2xl font-bold text-text-primary">{ENTITY_TYPES.length}</p>
        </div>
      </div>

      {/* Per-type grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {ENTITY_TYPES.map((type) => (
          <div
            key={type}
            className="rounded-lg border border-border bg-bg-card p-3 flex items-center gap-3"
          >
            <div
              className="size-3 rounded-full shrink-0"
              style={{ backgroundColor: entityColors[type] }}
            />
            <div className="min-w-0">
              <p className="text-xs text-text-secondary truncate">{entityLabels[type]}</p>
              <p className="text-lg font-semibold text-text-primary">{counts.get(type) ?? 0}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
