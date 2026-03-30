import type { ScaleLinear } from 'd3'
import type { Era } from './era.utils'

interface Props {
  eras: Era[]
  xScale: ScaleLinear<number, number>
  height: number
}

export function EraOverlay({ eras, xScale, height }: Props) {
  return (
    <g className="era-overlay" aria-hidden="true">
      {eras.map((era, i) => {
        const x = xScale(era.startYear)
        const w = xScale(era.endYear) - xScale(era.startYear)
        return (
          <g key={i}>
            <rect
              x={x}
              y={0}
              width={Math.max(w, 1)}
              height={height}
              fill="rgba(212, 175, 55, 0.05)"
            />
            {/* Era boundary line */}
            <line
              x1={x}
              y1={0}
              x2={x}
              y2={height}
              stroke="rgba(212, 175, 55, 0.15)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          </g>
        )
      })}
    </g>
  )
}
