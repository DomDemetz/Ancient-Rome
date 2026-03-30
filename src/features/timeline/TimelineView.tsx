import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { useShallow } from 'zustand/shallow'
import { entities } from '@/data'
import { useFilterStore } from '@/stores/useFilterStore'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { filterEntities } from '@/lib/filtering'
import type { Entity } from '@/types'
import { detectEras } from './era.utils'
import { EraOverlay } from './EraOverlay'
import { TimelineLane } from './TimelineLane'
import { TimelinePlayer } from './TimelinePlayer'
import { TimelineTooltip } from './TimelineTooltip'

const LANE_TYPES: Entity['entityType'][] = [
  'person',
  'event',
  'organization',
  'legion',
  'dynasty',
  'document',
  'infrastructure',
  'location',
]
const MIN_LANE_HEIGHT = 50
const MARGIN = { top: 32, right: 24, bottom: 36, left: 24 }
const MIN_YEAR = -753
const MAX_YEAR = 476

export function TimelineView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 900, height: 500 })
  const [tooltip, setTooltip] = useState<{ entity: Entity; x: number; y: number } | null>(null)

  const filters = useFilterStore(
    useShallow((s) => ({
      entityTypes: s.entityTypes,
      regions: s.regions,
      yearRange: s.yearRange,
    })),
  )

  const select = useSelectionStore((s) => s.select)

  // Observe container size — ResizeObserver fires immediately on observe()
  useEffect(() => {
    const node = containerRef.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) {
        setDimensions({ width, height })
      }
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const innerWidth = dimensions.width - MARGIN.left - MARGIN.right
  // Compute lane height to fill the available container height
  const availableHeight = dimensions.height - MARGIN.top - MARGIN.bottom
  const laneHeight = Math.max(Math.floor(availableHeight / LANE_TYPES.length), MIN_LANE_HEIGHT)
  const totalLanesHeight = LANE_TYPES.length * laneHeight
  const svgHeight = totalLanesHeight + MARGIN.top + MARGIN.bottom

  const xScale = useMemo(
    () => d3.scaleLinear().domain([MIN_YEAR, MAX_YEAR]).range([0, innerWidth]),
    [innerWidth],
  )

  // Filtered entities (without timelineYear filter — show all that pass other filters)
  const filteredEntities = useMemo(
    () =>
      filterEntities(entities, {
        entityTypes: filters.entityTypes,
        regions: filters.regions,
        yearRange: filters.yearRange,
      }),
    [filters],
  )

  // Entities grouped by lane type
  const entitiesByLane = useMemo(() => {
    const map = new Map<Entity['entityType'], Entity[]>()
    for (const type of LANE_TYPES) {
      map.set(
        type,
        filteredEntities.filter((e) => e.entityType === type),
      )
    }
    return map
  }, [filteredEntities])

  // Extract all years for era detection
  const allYears = useMemo(() => {
    const years: number[] = []
    for (const entity of filteredEntities) {
      switch (entity.entityType) {
        case 'person':
          if (entity.born !== undefined) years.push(entity.born)
          if (entity.died !== undefined) years.push(entity.died)
          break
        case 'event':
          if (entity.date !== undefined) years.push(entity.date)
          if (entity.endDate !== undefined) years.push(entity.endDate)
          break
        case 'organization':
          if (entity.founded !== undefined) years.push(entity.founded)
          if (entity.dissolved !== undefined) years.push(entity.dissolved)
          break
        case 'legion':
          if (entity.founded !== undefined) years.push(entity.founded)
          if (entity.disbanded !== undefined) years.push(entity.disbanded)
          break
      }
    }
    return years
  }, [filteredEntities])

  const eras = useMemo(() => detectEras(allYears, 0.5), [allYears])

  // X-axis tick values
  const xTicks = xScale.ticks(10)

  const handleHover = useCallback((entity: Entity | null, x: number, y: number) => {
    if (entity) {
      setTooltip({ entity, x, y })
    } else {
      setTooltip(null)
    }
  }, [])

  const handleSelect = useCallback(
    (entity: Entity) => {
      select(entity.id)
    },
    [select],
  )

  return (
    <div className="flex flex-col w-full h-full overflow-hidden">
      {/* Scrollable SVG area */}
      <div className="flex-1 overflow-auto relative" ref={containerRef}>
        <div className="relative" style={{ minHeight: svgHeight }}>
          <svg width={dimensions.width} height={svgHeight} className="block">
            <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
              {/* Era overlay */}
              <EraOverlay eras={eras} xScale={xScale} height={totalLanesHeight} />

              {/* Lane rows */}
              {LANE_TYPES.map((type, i) => (
                <TimelineLane
                  key={type}
                  entities={entitiesByLane.get(type) ?? []}
                  entityType={type}
                  xScale={xScale}
                  y={i * laneHeight}
                  height={laneHeight}
                  onHover={handleHover}
                  onSelect={handleSelect}
                />
              ))}

              {/* Horizontal dividers between lanes */}
              {LANE_TYPES.map((_, i) => (
                <line
                  key={i}
                  x1={0}
                  x2={innerWidth}
                  y1={i * laneHeight}
                  y2={i * laneHeight}
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth={1}
                />
              ))}

              {/* Bottom border */}
              <line
                x1={0}
                x2={innerWidth}
                y1={totalLanesHeight}
                y2={totalLanesHeight}
                stroke="rgba(255,255,255,0.1)"
                strokeWidth={1}
              />

              {/* X-axis */}
              <g transform={`translate(0,${totalLanesHeight})`}>
                {xTicks.map((tick) => {
                  const x = xScale(tick)
                  const label = tick < 0 ? `${Math.abs(tick)} BC` : tick === 0 ? '0' : `${tick} AD`
                  return (
                    <g key={tick} transform={`translate(${x},0)`}>
                      <line y1={0} y2={6} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
                      <text y={18} fontSize={10} textAnchor="middle" fill="rgba(255,255,255,0.55)">
                        {label}
                      </text>
                    </g>
                  )
                })}
              </g>
            </g>
          </svg>
        </div>

        {/* Empty state */}
        {filteredEntities.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-slate-500 text-sm text-center max-w-xs">
              No entities match the current filters. Try broadening your search or adjusting the
              year range.
            </p>
          </div>
        )}

        {/* Tooltip */}
        {tooltip && <TimelineTooltip entity={tooltip.entity} x={tooltip.x} y={tooltip.y} />}
      </div>

      {/* Timeline player */}
      <TimelinePlayer />
    </div>
  )
}
