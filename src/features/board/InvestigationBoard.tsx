import { useUIStore } from '@/stores/useUIStore'
import { TopBar } from './TopBar'
import { TrailBar } from './TrailBar'
import { FilterPanel } from '@/features/filters/FilterPanel'
import { PathFinder } from '@/features/search/PathFinder'
import { DetailPanel } from '@/features/detail/DetailPanel'
import { useURLSync } from '@/app/useURLSync'
import { useMobileDetect } from '@/app/useMobileDetect'
import { GraphView } from '@/features/graph/GraphView'
import { MapView } from '@/features/map/MapView'

const LENS_PLACEHOLDERS: Record<string, string> = {
  timeline: 'Timeline View (coming soon)',
  stats: 'Stats View (coming soon)',
}

export function InvestigationBoard() {
  useURLSync()
  useMobileDetect()
  const lens = useUIStore((s) => s.lens)
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)

  return (
    <div className="flex flex-col h-screen">
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — filters + path finder */}
        {sidebarOpen && (
          <aside className="w-[280px] shrink-0 border-r border-border bg-bg-secondary overflow-y-auto">
            <FilterPanel />
            <div className="border-t border-border" />
            <PathFinder />
          </aside>
        )}

        {/* Main content area */}
        <div className="flex-1 overflow-hidden relative">
          {lens === 'graph' && <GraphView />}
          {lens === 'map' && <MapView />}
          {lens !== 'graph' && lens !== 'map' && (
            <div className="flex items-center justify-center w-full h-full">
              <p className="text-text-secondary text-sm">{LENS_PLACEHOLDERS[lens]}</p>
            </div>
          )}
        </div>

        {/* Detail panel — shown when something is selected (desktop) */}
        <DetailPanel />
      </div>

      <TrailBar />
    </div>
  )
}
