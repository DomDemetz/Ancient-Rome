import { useMemo } from 'react'
import { entities, connections } from '@/data'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { getConnectionCategory, entityLabels } from '@/lib/colors'

export function PowerRankings() {
  const select = useSelectionStore((s) => s.select)

  const rankings = useMemo(() => {
    const scores = new Map<string, number>()
    for (const c of connections) {
      const cat = getConnectionCategory(c.connectionType)
      const base = c.strength
      const politicalBonus = cat === 'political' ? 1 : 0
      scores.set(c.source, (scores.get(c.source) ?? 0) + base + politicalBonus)
      scores.set(c.target, (scores.get(c.target) ?? 0) + base)
    }

    const entityMap = new Map(entities.map((e) => [e.id, e]))
    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, score]) => ({ entity: entityMap.get(id)!, score }))
      .filter((r) => r.entity)
  }, [])

  const max = Math.max(...rankings.map((r) => r.score), 1)

  return (
    <div className="rounded-lg border border-border bg-bg-card p-4">
      <h3 className="mb-3 text-sm font-medium text-text-primary">Power Rankings</h3>
      <div className="space-y-1.5">
        {rankings.map((r, i) => (
          <button
            key={r.entity.id}
            onClick={() => select(r.entity.id)}
            className="flex w-full items-center gap-2 rounded px-1 text-xs hover:bg-bg-secondary"
          >
            <span className="w-4 shrink-0 text-text-secondary">{i + 1}</span>
            <span className="w-28 shrink-0 truncate text-left text-text-primary">
              {r.entity.name}
            </span>
            <span className="w-16 shrink-0 text-left text-text-secondary">
              {entityLabels[r.entity.entityType]}
            </span>
            <div className="h-3 flex-1 rounded bg-bg-secondary">
              <div
                className="h-full rounded bg-accent-gold"
                style={{ width: `${(r.score / max) * 100}%` }}
              />
            </div>
            <span className="w-6 text-right text-text-secondary">{r.score}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
