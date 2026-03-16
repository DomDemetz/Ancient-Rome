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
    <div className="flex items-center gap-1">
      {LENSES.map(({ id, label, icon: Icon }) => {
        const isActive = lens === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => switchLens(id)}
            aria-pressed={isActive}
            className={`
              inline-flex items-center justify-center gap-2 rounded-full
              min-h-[44px] px-4 text-sm transition-colors
              ${
                isActive
                  ? 'bg-accent-gold text-black font-medium shadow-lg shadow-accent-gold/20'
                  : 'bg-bg-card text-text-secondary border border-border hover:bg-bg-secondary'
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
