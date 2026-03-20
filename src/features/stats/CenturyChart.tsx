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

function ordinal(n: number): string {
  return `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`
}

function centuryLabel(year: number): string {
  if (year < 0) {
    const c = Math.ceil(Math.abs(year) / 100)
    return `${ordinal(c)} c. BC`
  }
  // Year 0 doesn't exist historically; treat as 1st c. AD
  const c = Math.max(1, Math.ceil(year / 100))
  return `${ordinal(c)} c. AD`
}

function centurySortKey(year: number): number {
  if (year < 0) return Math.ceil(year / 100)
  return Math.max(1, Math.ceil(year / 100))
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
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
      <h3 className="mb-3 text-sm font-medium text-slate-100">Entities by Century</h3>
      <div className="space-y-1.5">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2 text-xs">
            <span className="w-24 shrink-0 text-right text-slate-500">{d.label}</span>
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
