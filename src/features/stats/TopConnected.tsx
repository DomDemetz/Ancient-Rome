import { useMemo } from 'react'
import { entities, connections } from '@/data'
import { entityColors, entityLabels } from '@/lib/colors'
import { useSelectionStore } from '@/stores/useSelectionStore'

export function TopConnected() {
  const select = useSelectionStore((s) => s.select)

  const topEntities = useMemo(() => {
    const countMap = new Map<string, number>()
    for (const c of connections) {
      countMap.set(c.source, (countMap.get(c.source) ?? 0) + 1)
      countMap.set(c.target, (countMap.get(c.target) ?? 0) + 1)
    }

    return entities
      .map((e) => ({ entity: e, count: countMap.get(e.id) ?? 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [])

  const maxCount = topEntities[0]?.count ?? 1

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
      <h3 className="text-sm font-medium text-slate-100 mb-4">Top 10 Most Connected</h3>
      <div className="space-y-2">
        {topEntities.map(({ entity, count }) => {
          const pct = (count / maxCount) * 100
          return (
            <button
              key={entity.id}
              className="w-full text-left group"
              onClick={() => select(entity.id)}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <div
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: entityColors[entity.entityType] }}
                />
                <span className="text-xs text-slate-100 truncate flex-1 group-hover:text-amber-500 transition-colors">
                  {entity.name}
                </span>
                <span className="text-xs text-slate-500 shrink-0">{count}</span>
              </div>
              <div className="ml-4 h-1.5 rounded-full bg-white/[0.02] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: entityColors[entity.entityType],
                    opacity: 0.7,
                  }}
                />
              </div>
            </button>
          )
        })}
      </div>

      {topEntities.length === 0 && (
        <p className="text-xs text-slate-500 text-center py-4">No data available</p>
      )}

      <p className="text-xs text-slate-500 mt-3">
        Showing by {entityLabels[topEntities[0]?.entity.entityType ?? 'person']} type. Click to
        inspect.
      </p>
    </div>
  )
}
