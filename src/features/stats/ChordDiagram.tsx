import { useMemo } from 'react'
import { entities, connections } from '@/data'
import { entityLabels } from '@/lib/colors'
import type { Entity } from '@/types'

export function ChordDiagram() {
  const data = useMemo(() => {
    const entityMap = new Map<string, Entity['entityType']>()
    for (const e of entities) entityMap.set(e.id, e.entityType)

    const pairCounts = new Map<string, number>()
    for (const c of connections) {
      const s = entityMap.get(c.source)
      const t = entityMap.get(c.target)
      if (!s || !t) continue
      const key = [s, t].sort().join(' \u2194 ')
      pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
    }

    return [...pairCounts.entries()]
      .map(([pair, count]) => ({ pair, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [])

  const max = Math.max(...data.map((d) => d.count), 1)

  const formatPair = (pair: string) =>
    pair
      .split(' \u2194 ')
      .map((t) => entityLabels[t as Entity['entityType']] ?? t)
      .join(' \u2194 ')

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
      <h3 className="mb-3 text-sm font-medium text-slate-100">Entity Type Connections</h3>
      <div className="space-y-1.5">
        {data.map((d) => (
          <div key={d.pair} className="flex items-center gap-2 text-xs">
            <span className="w-36 shrink-0 truncate text-right text-slate-500">
              {formatPair(d.pair)}
            </span>
            <div className="h-4 flex-1 rounded bg-white/[0.02]">
              <div
                className="h-full rounded bg-amber-500"
                style={{ width: `${(d.count / max) * 100}%` }}
              />
            </div>
            <span className="w-6 text-slate-500">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
