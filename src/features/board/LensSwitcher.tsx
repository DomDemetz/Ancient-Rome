import { Map, Network, Clock, BarChart3, type LucideIcon } from 'lucide-react'
import { useUIStore, type Lens } from '@/stores/useUIStore'

const LENSES: { id: Lens; label: string; icon: LucideIcon }[] = [
  { id: 'map', label: 'Map', icon: Map },
  { id: 'graph', label: 'Graph', icon: Network },
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
]

/** Inline pill switcher for desktop TopBar */
export function LensSwitcher() {
  const lens = useUIStore((s) => s.lens)
  const switchLens = useUIStore((s) => s.switchLens)

  return (
    <div className="flex items-center bg-black/40 border border-white/[0.06] rounded-xl p-0.5 gap-0.5">
      {LENSES.map(({ id, label, icon: Icon }) => {
        const isActive = lens === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => switchLens(id)}
            aria-pressed={isActive}
            className={`
              inline-flex items-center justify-center gap-1.5 rounded-[9px]
              px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-all duration-200
              ${
                isActive
                  ? 'bg-gradient-to-b from-amber-500 to-amber-600 text-white shadow-[0_2px_12px_rgba(180,83,9,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]'
                  : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.04]'
              }
            `}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Fixed bottom tab bar for mobile — iOS-style navigation */
export function MobileTabBar() {
  const lens = useUIStore((s) => s.lens)
  const switchLens = useUIStore((s) => s.switchLens)

  return (
    <nav
      className="flex items-stretch bg-[#0a0a0c]/95 backdrop-blur-2xl border-t border-white/[0.06] shrink-0"
      style={{ zIndex: 1050, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {LENSES.map(({ id, label, icon: Icon }) => {
        const isActive = lens === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => switchLens(id)}
            aria-pressed={isActive}
            className={`
              flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[52px]
              transition-colors duration-150
              ${isActive ? 'text-amber-500' : 'text-slate-600 active:text-slate-300'}
            `}
          >
            <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
            <span
              className={`text-[9px] font-semibold uppercase tracking-[0.1em] ${
                isActive ? 'text-amber-500' : 'text-slate-600'
              }`}
            >
              {label}
            </span>
            {isActive && <div className="absolute top-0 w-8 h-0.5 rounded-full bg-amber-500" />}
          </button>
        )
      })}
    </nav>
  )
}
