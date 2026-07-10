import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useShallow } from 'zustand/shallow'
import { DATASET_REGISTRY } from '@/data/datasetRegistry'
import { useMapLayerStore } from '@/stores/useMapLayerStore'
import { useUIStore } from '@/stores/useUIStore'
import { useMapNavStore } from '@/stores/useMapNavStore'

/**
 * Map-corner color key for the entity-atlas dots (the Sites categories).
 * Since the unified rework the atlas is the ONE taxonomy for structures —
 * this legend reads and toggles the same datasetState as the panel, so
 * there is no second category system to drift out of sync (the old
 * settlement legend duplicated the Sites list with per-DARE-type filters).
 * Shown while any Sites category is on; entries mirror the active set.
 */
export function SitesLegend() {
  const isMobile = useUIStore((s) => s.isMobile)
  const [collapsed, setCollapsed] = useState(isMobile)
  const { datasetState, toggleDataset } = useMapLayerStore(
    useShallow((s) => ({ datasetState: s.datasetState, toggleDataset: s.toggleDataset })),
  )
  // Below the atlas minZoom no dot can render — say why instead.
  // (nav-store view, NOT useMapViewport: this renders outside MapContainer)
  const zoom = useMapNavStore((s) => s.mapView?.zoom)
  const dotsRenderable = zoom == null || zoom >= 6

  return (
    <div
      className={`absolute z-[1000] bg-[#0a0a0c]/85 backdrop-blur-md border border-white/[0.08] rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.5)] text-xs text-[#ddd] max-w-[200px] ${
        isMobile ? 'bottom-4 left-3' : 'bottom-6 left-3'
      }`}
      style={{ pointerEvents: 'all' }}
    >
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-1.5 cursor-pointer bg-transparent border-none text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400"
      >
        <span>Sites</span>
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )}
      </button>

      {!collapsed && !dotsRenderable && (
        <div className="px-3 pb-2 text-[10px] italic text-slate-500">
          Zoom in to see individual sites
        </div>
      )}
      {!collapsed && dotsRenderable && (
        <div className="px-3 pb-2 flex flex-col gap-1">
          {DATASET_REGISTRY.filter((cfg) => datasetState[cfg.id]?.show).map((cfg) => {
            const on = datasetState[cfg.id]?.show ?? false
            return (
              <button
                key={cfg.id}
                onClick={() => toggleDataset(cfg.id)}
                className={`flex items-center gap-2 cursor-pointer bg-transparent border-none py-px text-left text-xs ${
                  on ? 'text-slate-300' : 'text-slate-600'
                }`}
              >
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: cfg.fillColor, opacity: on ? 1 : 0.3 }}
                />
                <span>{cfg.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
