import { useUIStore } from '@/stores/useUIStore'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { TopBar } from './TopBar'
import { TrailBar } from './TrailBar'

const LENS_PLACEHOLDERS: Record<string, string> = {
  graph: 'Graph View (coming soon)',
  map: 'Map View (coming soon)',
  timeline: 'Timeline View (coming soon)',
  stats: 'Stats View (coming soon)',
}

export function InvestigationBoard() {
  const lens = useUIStore((s) => s.lens)
  const selectedId = useSelectionStore((s) => s.selectedId)

  return (
    <div className="flex flex-col h-screen">
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Main content area */}
        <div className="flex-1 flex items-center justify-center overflow-auto">
          <p className="text-text-secondary text-sm">{LENS_PLACEHOLDERS[lens]}</p>
        </div>

        {/* Detail panel (340px) — shown when something is selected */}
        {selectedId && (
          <aside className="w-[340px] shrink-0 border-l border-border flex items-center justify-center overflow-auto">
            <p className="text-text-secondary text-sm">Detail panel (coming soon)</p>
          </aside>
        )}
      </div>

      <TrailBar />
    </div>
  )
}
