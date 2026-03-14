import { useFilterStore } from '@/stores/useFilterStore'
import { connectionCategoryColors } from '@/lib/colors'
import type { ConnectionType } from '@/types'
import type { ConnectionCategory } from '@/lib/colors'

const CATEGORIES: ConnectionCategory[] = [
  'political',
  'military',
  'social',
  'geographic',
  'cultural',
]

const CONNECTION_TYPES_BY_CATEGORY: Record<ConnectionCategory, ConnectionType[]> = {
  political: ['alliance', 'opposition', 'faction', 'succession', 'assassination', 'appointment'],
  military: ['commanded', 'served_in', 'battle_participation', 'campaign', 'defeated'],
  social: ['family', 'mentorship', 'patronage', 'rivalry', 'marriage'],
  geographic: ['located_in', 'governed', 'trade_route', 'military_route'],
  cultural: ['authored', 'dedicated_to', 'worship', 'built', 'founded'],
}

const CATEGORY_LABELS: Record<ConnectionCategory, string> = {
  political: 'Political',
  military: 'Military',
  social: 'Social',
  geographic: 'Geographic',
  cultural: 'Cultural',
}

export function ConnectionTypeFilter() {
  const connectionTypes = useFilterStore((s) => s.connectionTypes)
  const setFilter = useFilterStore((s) => s.setFilter)

  function isCategoryActive(category: ConnectionCategory): boolean {
    if (connectionTypes.length === 0) return true
    return CONNECTION_TYPES_BY_CATEGORY[category].some((t) => connectionTypes.includes(t))
  }

  function toggleCategory(category: ConnectionCategory) {
    const categoryTypes = CONNECTION_TYPES_BY_CATEGORY[category]
    const allActive =
      connectionTypes.length === 0 || categoryTypes.every((t) => connectionTypes.includes(t))

    if (allActive) {
      // Deactivate: if currently empty (all shown), add all EXCEPT this category
      if (connectionTypes.length === 0) {
        const others = CATEGORIES.filter((c) => c !== category).flatMap(
          (c) => CONNECTION_TYPES_BY_CATEGORY[c],
        )
        setFilter('connectionTypes', others)
      } else {
        setFilter(
          'connectionTypes',
          connectionTypes.filter((t) => !categoryTypes.includes(t)),
        )
      }
    } else {
      // Activate: add this category's types
      const next = [...new Set([...connectionTypes, ...categoryTypes])]
      // If all categories now active, reset to empty (= all shown)
      const allTypes = CATEGORIES.flatMap((c) => CONNECTION_TYPES_BY_CATEGORY[c])
      if (next.length >= allTypes.length) {
        setFilter('connectionTypes', [])
      } else {
        setFilter('connectionTypes', next)
      }
    }
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
        Connection Types
      </p>
      {CATEGORIES.map((category) => {
        const active = isCategoryActive(category)
        const color = connectionCategoryColors[category]
        return (
          <label
            key={category}
            className="flex items-center gap-2 cursor-pointer py-0.5 text-xs transition-colors"
          >
            <input
              type="checkbox"
              checked={active}
              onChange={() => toggleCategory(category)}
              className="sr-only"
            />
            <span
              className="size-2.5 rounded-full shrink-0 transition-opacity"
              style={{ backgroundColor: color, opacity: active ? 1 : 0.3 }}
            />
            <span className={active ? 'text-text-primary' : 'text-text-secondary'}>
              {CATEGORY_LABELS[category]}
            </span>
            <span className="ml-auto">
              <span
                className={`size-3.5 flex items-center justify-center rounded border ${
                  active ? 'border-accent-gold bg-accent-gold/20' : 'border-border'
                }`}
              >
                {active && (
                  <svg viewBox="0 0 10 8" className="w-2.5 h-2" fill="none">
                    <path
                      d="M1 4l3 3 5-6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-accent-gold"
                    />
                  </svg>
                )}
              </span>
            </span>
          </label>
        )
      })}
    </div>
  )
}
