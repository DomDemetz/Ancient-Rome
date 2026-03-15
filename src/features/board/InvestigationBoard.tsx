import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
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
import { TimelineView } from '@/features/timeline/TimelineView'
import { StatsView } from '@/features/stats/StatsView'
import { useStoryMode } from '@/features/stories/useStoryMode'
import { NarrationBar } from '@/features/stories/NarrationBar'
import { stories } from '@/data'

export function InvestigationBoard() {
  useURLSync()
  useMobileDetect()
  const lens = useUIStore((s) => s.lens)
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)

  const storyMode = useStoryMode()
  const [searchParams] = useSearchParams()

  // Auto-start story from URL param (e.g., /investigate?story=fall-of-republic)
  useEffect(() => {
    const storyId = searchParams.get('story')
    if (storyId && !storyMode.isActive) {
      const story = stories.find((s) => s.id === storyId)
      if (story) storyMode.enter(story)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-screen">
      <TopBar storyMode={storyMode} />

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — shown only for graph view (filters + path finder) */}
        {sidebarOpen && lens === 'graph' && (
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
          {lens === 'timeline' && <TimelineView />}
          {lens === 'stats' && <StatsView />}
        </div>

        {/* Detail panel — shown when something is selected (desktop) */}
        <DetailPanel />
      </div>

      <TrailBar />

      {/* Narration bar — shown when story is active */}
      {storyMode.isActive && storyMode.activeStory && storyMode.currentStep && (
        <NarrationBar
          story={storyMode.activeStory}
          stepIndex={storyMode.stepIndex}
          currentStep={storyMode.currentStep}
          isLastStep={storyMode.isLastStep}
          onNext={storyMode.nextStep}
          onPrev={storyMode.prevStep}
          onExit={storyMode.exit}
        />
      )}
    </div>
  )
}
