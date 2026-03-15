import { useMemo } from 'react'
import { entities } from '@/data'

export function RegionChart() {
  const data = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of entities) {
      if (e.entityType === 'location' && 'province' in e && e.province) {
        counts.set(e.province, (counts.get(e.province) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .map(([province, count]) => ({ province, count }))
      .sort((a, b) => b.count - a.count)
  }, [])

  const max = Math.max(...data.map((d) => d.count), 1)

  return (
    <div className="rounded-lg border border-border bg-bg-card p-4">
      <h3 className="mb-3 text-sm font-medium text-text-primary">Locations by Province</h3>
      <div className="space-y-1.5">
        {data.map((d) => (
          <div key={d.province} className="flex items-center gap-2 text-xs">
            <span className="w-28 shrink-0 truncate text-right text-text-secondary">
              {d.province}
            </span>
            <div className="h-4 flex-1 rounded bg-bg-secondary">
              <div
                className="h-full rounded"
                style={{
                  width: `${(d.count / max) * 100}%`,
                  backgroundColor: 'var(--color-entity-location)',
                }}
              />
            </div>
            <span className="w-6 text-text-secondary">{d.count}</span>
          </div>
        ))}
        {data.length === 0 && (
          <p className="text-xs text-text-secondary">No locations with province data</p>
        )}
      </div>
    </div>
  )
}
