import { History } from 'lucide-react'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { useUIStore } from '@/stores/useUIStore'
import { entities } from '@/data'
import { entityColors } from '@/lib/colors'

const MAX_VISIBLE = 8

export function TrailBar() {
  const breadcrumbs = useSelectionStore((s) => s.breadcrumbs)
  const select = useSelectionStore((s) => s.select)
  const isMobile = useUIStore((s) => s.isMobile)

  if (breadcrumbs.length === 0) return null

  const visible = breadcrumbs.slice(-MAX_VISIBLE)

  return (
    <div className="flex items-center gap-1.5 border-t border-white/[0.05] px-4 py-2 shrink-0 overflow-x-auto">
      <History className="size-3.5 text-slate-400 shrink-0" />
      {visible.map((id, i) => {
        const entity = entities.find((e) => e.id === id)
        const color = entity ? entityColors[entity.entityType] : undefined
        return (
          <button
            key={`${id}-${breadcrumbs.length - MAX_VISIBLE + i}`}
            className={`cursor-pointer bg-white/[0.03] border border-white/[0.05] rounded-xl text-slate-300 hover:border-amber-500/20 hover:text-white transition-all inline-flex items-center gap-1.5 px-2.5 py-1 text-xs ${isMobile ? 'min-h-[44px]' : ''}`}
            onClick={() => select(id)}
          >
            {color && (
              <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
            )}
            {entity ? entity.name : id}
          </button>
        )
      })}
    </div>
  )
}
