import { Map, Network, Clock, type LucideIcon } from 'lucide-react'
import { useUIStore, type Lens } from '@/stores/useUIStore'

const LENSES: { id: Lens; label: string; icon: LucideIcon }[] = [
  { id: 'map', label: 'Map', icon: Map },
  { id: 'graph', label: 'Graph', icon: Network },
  { id: 'timeline', label: 'Timeline', icon: Clock },
]

export function LensSwitcher() {
  const lens = useUIStore((s) => s.lens)
  const switchLens = useUIStore((s) => s.switchLens)
  const isMobile = useUIStore((s) => s.isMobile)

  return (
    <div className="flex items-center bg-black/50 border border-white/[0.06] rounded-xl p-1">
      {LENSES.map(({ id, label, icon: Icon }) => {
        const isActive = lens === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => switchLens(id)}
            aria-pressed={isActive}
            className={`
              inline-flex items-center justify-center gap-2 rounded-[10px]
              px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] transition-all
              ${isMobile ? 'min-h-[44px]' : ''}
              ${
                isActive
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/30'
                  : 'text-slate-500 hover:text-white'
              }
            `}
          >
            <Icon size={16} />
            {!isMobile && <span>{label}</span>}
          </button>
        )
      })}
    </div>
  )
}
