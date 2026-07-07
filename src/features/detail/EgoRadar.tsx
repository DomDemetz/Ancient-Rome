import { useMemo } from 'react'
import { connectionCategoryColors } from '@/lib/colors'
import { getConnectionCategory } from '@/lib/colors'
import type { Connection } from '@/types'
import type { ConnectionCategory } from '@/lib/colors'

const CATEGORIES: ConnectionCategory[] = [
  'political',
  'military',
  'social',
  'geographic',
  'cultural',
]
const SIZE = 200
const CENTER = SIZE / 2
const MAX_RADIUS = 80
const GRID_CIRCLES = 3

interface EgoRadarProps {
  entityId: string
  connections: Connection[]
}

export function EgoRadar({ entityId, connections }: EgoRadarProps) {
  const counts = useMemo(() => {
    const result: Record<ConnectionCategory, number> = {
      political: 0,
      military: 0,
      social: 0,
      geographic: 0,
      cultural: 0,
    }
    for (const conn of connections) {
      if (conn.source === entityId || conn.target === entityId) {
        const cat = getConnectionCategory(conn.connectionType)
        result[cat]++
      }
    }
    return result
  }, [entityId, connections])

  const maxCount = Math.max(1, ...Object.values(counts))

  // Compute spoke angle for each category
  const spokeAngles = CATEGORIES.map((_, i) => {
    const angle = (i / CATEGORIES.length) * 2 * Math.PI - Math.PI / 2
    return angle
  })

  // Radar polygon points
  const polygonPoints = CATEGORIES.map((cat, i) => {
    const r = (counts[cat] / maxCount) * MAX_RADIUS
    const angle = spokeAngles[i]
    const x = CENTER + r * Math.cos(angle)
    const y = CENTER + r * Math.sin(angle)
    return `${x},${y}`
  }).join(' ')

  // Category dot positions (at tip of each spoke)
  const dotPositions = CATEGORIES.map((cat, i) => {
    const r = (counts[cat] / maxCount) * MAX_RADIUS
    const angle = spokeAngles[i]
    return {
      x: CENTER + r * Math.cos(angle),
      y: CENTER + r * Math.sin(angle),
      color: connectionCategoryColors[cat],
      cat,
      count: counts[cat],
    }
  })

  // Label positions (beyond max radius)
  const labelPositions = CATEGORIES.map((cat, i) => {
    const angle = spokeAngles[i]
    const r = MAX_RADIUS + 14
    return {
      x: CENTER + r * Math.cos(angle),
      y: CENTER + r * Math.sin(angle),
      cat,
      count: counts[cat],
    }
  })

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Connections</p>
      <div className="flex justify-center">
        {/* 32px side margins: the left/right axis labels center ~11px from
            the edge and were clipping to 'ultural' / 'ilitary' */}
        <svg width={SIZE + 64} height={SIZE} viewBox={`-32 0 ${SIZE + 64} ${SIZE}`}>
          {/* Grid circles */}
          {Array.from({ length: GRID_CIRCLES }, (_, i) => (
            <circle
              key={i}
              cx={CENTER}
              cy={CENTER}
              r={((i + 1) / GRID_CIRCLES) * MAX_RADIUS}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
              opacity="0.5"
            />
          ))}

          {/* Spokes */}
          {spokeAngles.map((angle, i) => (
            <line
              key={i}
              x1={CENTER}
              y1={CENTER}
              x2={CENTER + MAX_RADIUS * Math.cos(angle)}
              y2={CENTER + MAX_RADIUS * Math.sin(angle)}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
              opacity="0.5"
            />
          ))}

          {/* Polygon fill */}
          {maxCount > 0 && (
            <polygon
              points={polygonPoints}
              fill="#f59e0b"
              fillOpacity="0.15"
              stroke="#f59e0b"
              strokeWidth="1.5"
              strokeOpacity="0.6"
            />
          )}

          {/* Category dots */}
          {dotPositions.map(
            ({ x, y, color, cat, count }) =>
              count > 0 && (
                <circle
                  key={cat}
                  cx={x}
                  cy={y}
                  r={4}
                  fill={color}
                  stroke="rgba(255,255,255,0.03)"
                  strokeWidth="1.5"
                />
              ),
          )}

          {/* Labels */}
          {labelPositions.map(({ x, y, cat, count }) => (
            <text
              key={cat}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="9"
              fill="#64748b"
              className="capitalize"
            >
              {cat} {count > 0 ? `(${count})` : ''}
            </text>
          ))}
        </svg>
      </div>
    </div>
  )
}
