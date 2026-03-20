import type { ScaleLinear } from 'd3'
import type { Entity } from '@/types'
import { entityColors } from '@/lib/colors'

interface Props {
  entities: Entity[]
  entityType: Entity['entityType']
  xScale: ScaleLinear<number, number>
  y: number
  height: number
  onHover: (entity: Entity | null, x: number, y: number) => void
  onSelect: (entity: Entity) => void
}

const MIN_BAR_WIDTH_PX = 3

/**
 * Returns the [startYear, endYear] for an entity, or null if unavailable.
 */
function getEntityYearRange(entity: Entity): [number, number] | null {
  switch (entity.entityType) {
    case 'person':
      if (entity.born !== undefined || entity.died !== undefined) {
        const s = entity.born ?? entity.died!
        const e = entity.died ?? entity.born!
        return [s, e]
      }
      return null
    case 'event':
      if (entity.date !== undefined || entity.endDate !== undefined) {
        const s = entity.date ?? entity.endDate!
        const e = entity.endDate ?? entity.date!
        return [s, e]
      }
      return null
    case 'organization':
      if (entity.founded !== undefined || entity.dissolved !== undefined) {
        const s = entity.founded ?? entity.dissolved!
        const e = entity.dissolved ?? entity.founded!
        return [s, e]
      }
      return null
    case 'legion':
      if (entity.founded !== undefined || entity.disbanded !== undefined) {
        const s = entity.founded ?? entity.disbanded!
        const e = entity.disbanded ?? entity.founded!
        return [s, e]
      }
      return null
    case 'dynasty':
      if (entity.startYear !== undefined || entity.endYear !== undefined) {
        const s = entity.startYear ?? entity.endYear!
        const e = entity.endYear ?? entity.startYear!
        return [s, e]
      }
      return null
    case 'document':
      if (entity.date !== undefined) return [entity.date, entity.date]
      return null
    case 'infrastructure':
      if (entity.builtYear !== undefined) return [entity.builtYear, entity.builtYear]
      return null
    case 'location':
    case 'religion':
    case 'trade-good':
      return null
    default:
      return null
  }
}

export function TimelineLane({
  entities,
  entityType,
  xScale,
  y,
  height,
  onHover,
  onSelect,
}: Props) {
  const color = entityColors[entityType] ?? '#888'
  const barHeight = Math.max(height * 0.4, 4)
  const barY = y + (height - barHeight) / 2

  return (
    <g className={`timeline-lane lane-${entityType}`}>
      {/* Lane background stripe */}
      <rect
        x={xScale.range()[0]}
        y={y}
        width={xScale.range()[1] - xScale.range()[0]}
        height={height}
        fill="rgba(255,255,255,0.02)"
      />

      {/* Lane label */}
      <text
        x={xScale.range()[0] + 4}
        y={y + height / 2 + 4}
        fontSize={10}
        fill="rgba(255,255,255,0.3)"
        pointerEvents="none"
        style={{ userSelect: 'none' }}
      >
        {entityType}
      </text>

      {/* Entity bars */}
      {entities.map((entity) => {
        const range = getEntityYearRange(entity)
        if (!range) return null

        const [startYear, endYear] = range
        const x = xScale(startYear)
        const rawWidth = xScale(endYear) - xScale(startYear)
        const width = Math.max(rawWidth, MIN_BAR_WIDTH_PX)

        return (
          <rect
            key={entity.id}
            x={x}
            y={barY}
            width={width}
            height={barHeight}
            fill={color}
            fillOpacity={0.7}
            rx={2}
            cursor="pointer"
            onMouseEnter={(e) => onHover(entity, e.clientX, e.clientY)}
            onMouseLeave={() => onHover(null, 0, 0)}
            onClick={() => onSelect(entity)}
          />
        )
      })}
    </g>
  )
}
