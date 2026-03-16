import { useMemo } from 'react'
import { connections } from '@/data'
import {
  connectionCategoryColors,
  getConnectionCategory,
  type ConnectionCategory,
} from '@/lib/colors'

const CATEGORIES: ConnectionCategory[] = [
  'political',
  'military',
  'social',
  'geographic',
  'cultural',
]

const CATEGORY_LABELS: Record<ConnectionCategory, string> = {
  political: 'Political',
  military: 'Military',
  social: 'Social',
  geographic: 'Geographic',
  cultural: 'Cultural',
}

export function ConnectionDist() {
  const counts = useMemo(() => {
    const map = new Map<ConnectionCategory, number>()
    for (const cat of CATEGORIES) map.set(cat, 0)
    for (const c of connections) {
      const cat = getConnectionCategory(c.connectionType)
      map.set(cat, (map.get(cat) ?? 0) + 1)
    }
    return map
  }, [])

  const maxCount = Math.max(...CATEGORIES.map((c) => counts.get(c) ?? 0), 1)

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
      <h3 className="text-sm font-medium text-slate-100 mb-4">Connections by Category</h3>
      <div className="space-y-3">
        {CATEGORIES.map((cat) => {
          const count = counts.get(cat) ?? 0
          const pct = (count / maxCount) * 100
          return (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: connectionCategoryColors[cat] }}
                />
                <span className="text-xs text-slate-500 flex-1">{CATEGORY_LABELS[cat]}</span>
                <span className="text-xs text-slate-100 font-medium">{count}</span>
              </div>
              <div className="ml-4 h-2 rounded-full bg-white/[0.02] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: connectionCategoryColors[cat],
                    opacity: 0.8,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-slate-500 mt-3">
        Total: {connections.length.toLocaleString()} connections
      </p>
    </div>
  )
}
