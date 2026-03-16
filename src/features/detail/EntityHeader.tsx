import { Pin, PinOff } from 'lucide-react'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { entityColors, entityLabels, entityIcons } from '@/lib/colors'
import { formatYear } from '@/lib/geo'
import { Button } from '@/ui/button'
import type { Entity } from '@/types'

function getEntityDates(entity: Entity): { start?: number; end?: number } {
  switch (entity.entityType) {
    case 'person':
      return { start: entity.born, end: entity.died }
    case 'organization':
      return { start: entity.founded, end: entity.dissolved }
    case 'event':
      return { start: entity.date, end: entity.endDate }
    default:
      return {}
  }
}

interface EntityHeaderProps {
  entity: Entity
}

export function EntityHeader({ entity }: EntityHeaderProps) {
  const pinnedIds = useSelectionStore((s) => s.pinnedIds)
  const pin = useSelectionStore((s) => s.pin)
  const unpin = useSelectionStore((s) => s.unpin)

  const isPinned = pinnedIds.includes(entity.id)
  const dates = getEntityDates(entity)
  const color = entityColors[entity.entityType]
  const label = entityLabels[entity.entityType]
  const Icon = entityIcons[entity.entityType]

  function formatDates() {
    if (dates.start !== undefined && dates.end !== undefined) {
      return `${formatYear(dates.start)} – ${formatYear(dates.end)}`
    }
    if (dates.start !== undefined) {
      return formatYear(dates.start)
    }
    return null
  }

  const dateStr = formatDates()

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium"
              style={{ backgroundColor: `${color}22`, color }}
            >
              <Icon className="size-3" />
              {label}
            </span>
          </div>
          <h2 className="text-base font-semibold text-text-primary leading-tight">{entity.name}</h2>
          {dateStr && <p className="text-xs text-text-secondary">{dateStr}</p>}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => (isPinned ? unpin(entity.id) : pin(entity.id))}
          className="shrink-0 text-text-secondary hover:text-accent-gold"
          aria-label={isPinned ? 'Unpin entity' : 'Pin entity'}
        >
          {isPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
        </Button>
      </div>
      {entity.description && (
        <p className="text-xs text-text-secondary leading-relaxed">{entity.description}</p>
      )}
    </div>
  )
}
