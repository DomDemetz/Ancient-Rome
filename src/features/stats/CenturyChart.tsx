import { useMemo } from 'react'
import { entities } from '@/data'
import type { Entity } from '@/types'

function getStartYear(e: Entity): number | null {
  if ('born' in e && e.born != null) return e.born
  if ('date' in e && e.date != null) return e.date
  if ('founded' in e && e.founded != null) return e.founded
  if ('startYear' in e && e.startYear != null) return e.startYear
  if ('builtYear' in e && e.builtYear != null) return e.builtYear
  return null
}

function centuryLabel(year: number): string {
  if (year < 0) {
    const c = Math.ceil(Math.abs(year) / 100)
    return `${c}${c === 1 ? 'st' : c === 2 ? 'nd' : c === 3 ? 'rd' : 'th'} c. BC`
  }
  const c = Math.ceil(year / 100)
  return `${c}${c === 1 ? 'st' : c === 2 ? 'nd' : c === 3 ? 'rd' : 'th'} c. AD`
}

function centurySortKey(year: number): number {
  return year < 0 ? Math.ceil(year / 100) : Math.ceil(year / 100)
}

export function CenturyChart() {
  const data = useMemo(() => {
    const counts = new Map<number, { label: string; count: number }>()
    for (const e of entities) {
      const y = getStartYear(e)
      if (y == null) continue
      const key = centurySortKey(y)
      const existing = counts.get(key)
      if (existing) existing.count++
      else counts.set(key, { label: centuryLabel(y), count: 1 })
    }
    return [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v)
  }, [])

  const max = Math.max(...data.map((d) => d.count), 1)

  return (
    <div className="rounded-lg border border-border bg-bg-card p-4">
      <h3 className="mb-3 text-sm font-medium text-text-primary">Entities by Century</h3>
      <div className="space-y-1.5">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2 text-xs">
            <span className="w-24 shrink-0 text-right text-text-secondary">{d.label}</span>
            <div className="h-4 flex-1 rounded bg-bg-secondary">
              <div
                className="h-full rounded bg-accent-gold"
                style={{ width: `${(d.count / max) * 100}%` }}
              />
            </div>
            <span className="w-6 text-text-secondary">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
