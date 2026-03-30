import { Pin, PinOff } from 'lucide-react'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { entityLabels, entityIcons } from '@/lib/colors'
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
  const label = entityLabels[entity.entityType]
  const Icon = entityIcons[entity.entityType]

  // dates are rendered in the stat grid below

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-3 min-w-0">
          <span className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-bold uppercase tracking-[0.3em] rounded-md px-3 py-1">
            <Icon className="size-3" />
            {label}
          </span>
          <h2 className="text-3xl font-serif italic text-slate-100 leading-[1.1]">{entity.name}</h2>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => (isPinned ? unpin(entity.id) : pin(entity.id))}
          className="shrink-0 text-slate-500 hover:text-amber-500 active:text-amber-500"
          aria-label={isPinned ? 'Unpin entity' : 'Pin entity'}
        >
          {isPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
        </Button>
      </div>

      {entity.description && (
        <p className="text-sm text-slate-400 leading-relaxed italic border-l-2 border-amber-500/30 pl-4">
          &ldquo;{entity.description}&rdquo;
        </p>
      )}

      {/* Stat grid for dates */}
      {dates.start !== undefined && (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-3.5">
            <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600 mb-1">
              {entity.entityType === 'person'
                ? 'Born'
                : entity.entityType === 'event'
                  ? 'Start'
                  : 'Founded'}
            </div>
            <div className="text-lg font-light text-slate-200">{formatYear(dates.start)}</div>
          </div>
          {dates.end !== undefined && (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-3.5">
              <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600 mb-1">
                {entity.entityType === 'person'
                  ? 'Died'
                  : entity.entityType === 'event'
                    ? 'End'
                    : 'Dissolved'}
              </div>
              <div className="text-lg font-light text-slate-200">{formatYear(dates.end)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
