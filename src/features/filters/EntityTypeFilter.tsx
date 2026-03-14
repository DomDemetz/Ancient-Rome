import { useFilterStore } from '@/stores/useFilterStore'
import { entityColors, entityLabels } from '@/lib/colors'
import type { Entity } from '@/types'

const ALL_ENTITY_TYPES: Entity['entityType'][] = [
  'person',
  'organization',
  'event',
  'location',
  'document',
  'legion',
  'dynasty',
  'religion',
  'trade-good',
  'infrastructure',
]

export function EntityTypeFilter() {
  const entityTypes = useFilterStore((s) => s.entityTypes)
  const setFilter = useFilterStore((s) => s.setFilter)

  function toggle(type: Entity['entityType']) {
    const next = entityTypes.includes(type)
      ? entityTypes.filter((t) => t !== type)
      : [...entityTypes, type]
    setFilter('entityTypes', next)
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
        Entity Types
      </p>
      {ALL_ENTITY_TYPES.map((type) => {
        const checked = entityTypes.length === 0 || entityTypes.includes(type)
        return (
          <label
            key={type}
            className="flex items-center gap-2 cursor-pointer py-0.5 hover:text-text-primary text-text-secondary text-xs transition-colors"
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(type)}
              className="sr-only"
            />
            <span
              className="size-2.5 rounded-full shrink-0 transition-opacity"
              style={{
                backgroundColor: entityColors[type],
                opacity: checked ? 1 : 0.3,
              }}
            />
            <span className={checked ? 'text-text-primary' : 'text-text-secondary'}>
              {entityLabels[type]}
            </span>
            <span className="ml-auto">
              <span
                className={`size-3.5 flex items-center justify-center rounded border ${
                  checked ? 'border-accent-gold bg-accent-gold/20' : 'border-border'
                }`}
              >
                {checked && (
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
