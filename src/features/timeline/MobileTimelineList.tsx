import { useMemo } from 'react'
import type { Entity } from '@/types'
import { entityColors, entityLabels } from '@/lib/colors'
import { formatYear } from '@/lib/geo'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { ScrollArea } from '@/ui/scroll-area'

interface Props {
  entities: Entity[]
}

function getSortYear(entity: Entity): number | null {
  switch (entity.entityType) {
    case 'person':
      return entity.born ?? entity.died ?? null
    case 'event':
      return entity.date ?? entity.endDate ?? null
    case 'organization':
      return entity.founded ?? entity.dissolved ?? null
    case 'legion':
      return entity.founded ?? entity.disbanded ?? null
    case 'dynasty':
      return entity.startYear ?? entity.endYear ?? null
    case 'document':
      return entity.date ?? null
    case 'infrastructure':
      return entity.builtYear ?? null
    default:
      return null
  }
}

function getDateLabel(entity: Entity): string {
  switch (entity.entityType) {
    case 'person': {
      const parts: string[] = []
      if (entity.born != null) parts.push(formatYear(entity.born))
      if (entity.died != null) parts.push(formatYear(entity.died))
      return parts.join(' – ')
    }
    case 'event':
      if (entity.date != null && entity.endDate != null && entity.date !== entity.endDate)
        return `${formatYear(entity.date)} – ${formatYear(entity.endDate)}`
      return entity.date != null ? formatYear(entity.date) : ''
    case 'organization':
      if (entity.founded != null && entity.dissolved != null)
        return `${formatYear(entity.founded)} – ${formatYear(entity.dissolved)}`
      return entity.founded != null ? `f. ${formatYear(entity.founded)}` : ''
    case 'legion':
      if (entity.founded != null && entity.disbanded != null)
        return `${formatYear(entity.founded)} – ${formatYear(entity.disbanded)}`
      return entity.founded != null ? `f. ${formatYear(entity.founded)}` : ''
    case 'dynasty':
      if (entity.startYear != null && entity.endYear != null)
        return `${formatYear(entity.startYear)} – ${formatYear(entity.endYear)}`
      return entity.startYear != null ? formatYear(entity.startYear) : ''
    case 'document':
      return entity.date != null ? formatYear(entity.date) : ''
    case 'infrastructure':
      return entity.builtYear != null ? formatYear(entity.builtYear) : ''
    default:
      return ''
  }
}

export function MobileTimelineList({ entities }: Props) {
  const select = useSelectionStore((s) => s.select)
  const currentYear = useTimelineStore((s) => s.currentYear)

  // Sort entities by date, filter to those near the current year (±100)
  const visibleEntities = useMemo(() => {
    const withYear = entities
      .map((e) => ({ entity: e, year: getSortYear(e) }))
      .filter((e): e is { entity: Entity; year: number } => e.year !== null)
      .sort((a, b) => a.year - b.year)

    // Show entities within ±100 years of current timeline position
    const window = 100
    const nearby = withYear.filter(
      (e) => e.year >= currentYear - window && e.year <= currentYear + window,
    )

    // If fewer than 10 nearby, show all sorted entities instead
    return (nearby.length >= 5 ? nearby : withYear).slice(0, 80)
  }, [entities, currentYear])

  if (visibleEntities.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-slate-500 text-sm text-center">No entities match the current filters.</p>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <div className="px-3 py-2 space-y-0.5">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-amber-500/40 px-3 py-1">
          {visibleEntities.length} entities near {formatYear(Math.round(currentYear))}
        </p>
        {visibleEntities.map(({ entity, year }) => {
          const color = entityColors[entity.entityType]
          const dateLabel = getDateLabel(entity)
          const isCurrent = Math.abs(year - currentYear) < 20

          return (
            <button
              key={entity.id}
              onClick={() => select(entity.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg text-left transition-all ${
                isCurrent
                  ? 'bg-white/[0.04] border border-white/[0.08]'
                  : 'border border-transparent hover:bg-white/[0.03] active:bg-white/[0.05]'
              }`}
            >
              <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-slate-200 block truncate">{entity.name}</span>
                <span className="text-[10px] text-slate-500">
                  {entityLabels[entity.entityType]} · {dateLabel}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </ScrollArea>
  )
}
