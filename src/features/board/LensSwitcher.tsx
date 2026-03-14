import { Button } from '@/ui/button'
import { useUIStore, type Lens } from '@/stores/useUIStore'

const LENSES: { id: Lens; label: string }[] = [
  { id: 'graph', label: 'Graph' },
  { id: 'map', label: 'Map' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'stats', label: 'Stats' },
]

export function LensSwitcher() {
  const lens = useUIStore((s) => s.lens)
  const switchLens = useUIStore((s) => s.switchLens)

  return (
    <div className="flex items-center gap-1">
      {LENSES.map(({ id, label }) => (
        <Button
          key={id}
          variant={lens === id ? 'default' : 'ghost'}
          size="sm"
          onClick={() => switchLens(id)}
          aria-pressed={lens === id}
        >
          {label}
        </Button>
      ))}
    </div>
  )
}
