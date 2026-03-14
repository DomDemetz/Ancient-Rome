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
          <rect
            key={i}
            x={x}
            y={0}
            width={Math.max(w, 1)}
            height={height}
            fill="rgba(212, 175, 55, 0.08)"
            stroke="rgba(212, 175, 55, 0.25)"
            strokeWidth={1}
          />
        )
      })}
    </g>
  )
}
