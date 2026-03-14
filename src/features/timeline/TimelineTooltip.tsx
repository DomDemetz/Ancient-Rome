import type { Entity } from '@/types'
import { formatYear } from '@/lib/geo'

interface Props {
  entity: Entity
  x: number
  y: number
}

function getEntityDateLabel(entity: Entity): string {
  switch (entity.entityType) {
    case 'person':
      if (entity.born !== undefined && entity.died !== undefined) {
        return `${formatYear(entity.born)} – ${formatYear(entity.died)}`
      }
      if (entity.born !== undefined) return `b. ${formatYear(entity.born)}`
      if (entity.died !== undefined) return `d. ${formatYear(entity.died)}`
      return ''
    case 'event':
      if (
        entity.date !== undefined &&
        entity.endDate !== undefined &&
        entity.date !== entity.endDate
      ) {
        return `${formatYear(entity.date)} – ${formatYear(entity.endDate)}`
      }
      if (entity.date !== undefined) return formatYear(entity.date)
      if (entity.endDate !== undefined) return formatYear(entity.endDate)
      return ''
    case 'organization':
      if (entity.founded !== undefined && entity.dissolved !== undefined) {
        return `${formatYear(entity.founded)} – ${formatYear(entity.dissolved)}`
      }
      if (entity.founded !== undefined) return `f. ${formatYear(entity.founded)}`
      if (entity.dissolved !== undefined) return `d. ${formatYear(entity.dissolved)}`
      return ''
    case 'legion':
      if (entity.founded !== undefined && entity.disbanded !== undefined) {
        return `${formatYear(entity.founded)} – ${formatYear(entity.disbanded)}`
      }
      if (entity.founded !== undefined) return `f. ${formatYear(entity.founded)}`
      if (entity.disbanded !== undefined) return `disb. ${formatYear(entity.disbanded)}`
      return ''
    case 'location':
      return ''
    default:
      return ''
  }
}

export function TimelineTooltip({ entity, x, y }: Props) {
  const dateLabel = getEntityDateLabel(entity)

  return (
    <div
      className="absolute z-50 pointer-events-none bg-bg-secondary border border-border rounded px-2 py-1 shadow-md text-sm"
      style={{ left: x + 12, top: y - 8 }}
    >
      <div className="font-semibold text-text-primary">{entity.name}</div>
      {dateLabel && <div className="text-text-secondary text-xs mt-0.5">{dateLabel}</div>}
    </div>
  )
}
