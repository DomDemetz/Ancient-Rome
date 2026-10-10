import { useMapNavStore } from '@/stores/useMapNavStore'
import { useUIStore } from '@/stores/useUIStore'
import {
  scaleRows,
  graticuleStepMinutes,
  gridCellMeters,
  formatArc,
  formatDistance,
} from '@/lib/measure'

const MAX_BAR_PX = 120

/**
 * Distance key for the map: the same stretch of ground in kilometres, miles
 * and Roman miles (mille passus — a thousand paces), plus what one grid
 * square measures while the grid is on. This projection stretches toward
 * the north, so every figure is for the centre of the view, and says so.
 */
export function ScaleLegend() {
  const view = useMapNavStore((s) => s.mapView)
  const showGraticule = useUIStore((s) => s.showGraticule)
  const showScaleBar = useUIStore((s) => s.showScaleBar)
  const rulerActive = useUIStore((s) => s.rulerActive)
  if (!view || (!showGraticule && !showScaleBar && !rulerActive)) return null

  const step = graticuleStepMinutes(view.zoom)
  const cell = gridCellMeters(step, view.lat)

  return (
    <div
      className="bg-[#0a0a0c]/85 backdrop-blur-md border border-white/[0.08] rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.5)] px-3 py-2 text-[10px] text-slate-300 tabular-nums pointer-events-auto"
      title="1 Roman mile = 1,000 paces = 5,000 Roman feet ≈ 1.48 km. Distances are true at the centre of the view: the map stretches toward the north."
    >
      {(showScaleBar || showGraticule) && (
        <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500 mb-1.5">
          {showScaleBar ? 'Scale' : 'Grid'} <span className="font-normal">at map centre</span>
        </div>
      )}
      {showScaleBar && (
        <div className="flex flex-col gap-1">
          {scaleRows(view.lat, view.zoom, MAX_BAR_PX).map((r) => (
            <div key={r.label} className="flex items-center gap-2">
              <span
                className="h-1.5 border-x border-b border-slate-300/80 shrink-0"
                style={{ width: r.px }}
              />
              <span className="whitespace-nowrap">{r.label}</span>
            </div>
          ))}
        </div>
      )}
      {showGraticule && (
        <div className={showScaleBar ? 'mt-1.5 pt-1.5 border-t border-white/[0.06]' : ''}>
          <div>
            Grid lines every <span className="text-amber-50">{formatArc(step)}</span>
          </div>
          <div className="text-slate-400">
            {formatDistance(cell.ns)} north–south · {formatDistance(cell.ew)} east–west
          </div>
        </div>
      )}
      {rulerActive && (
        <div
          className={
            showScaleBar || showGraticule ? 'mt-1.5 pt-1.5 border-t border-white/[0.06]' : ''
          }
        >
          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-amber-500/70">
            Ruler
          </div>
          <div className="text-slate-400">Click two points for the straight-line distance</div>
        </div>
      )}
    </div>
  )
}
