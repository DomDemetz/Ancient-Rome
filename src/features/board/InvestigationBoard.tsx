import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useUIStore } from '@/stores/useUIStore'
import { TopBar } from './TopBar'
import { TrailBar } from './TrailBar'
import { FilterPanel } from '@/features/filters/FilterPanel'
import { PathFinder } from '@/features/search/PathFinder'
import { DetailPanel } from '@/features/detail/DetailPanel'
import { WikiDetailPanel } from '@/features/detail/WikiDetailPanel'
import { useURLSync } from '@/app/useURLSync'
import { useMobileDetect } from '@/app/useMobileDetect'
import { GraphView } from '@/features/graph/GraphView'
import { MapView } from '@/features/map/MapView'
import { TimelineView } from '@/features/timeline/TimelineView'
import { StatsView } from '@/features/stats/StatsView'
import { useStoryMode } from '@/features/stories/useStoryMode'
import { NarrationBar } from '@/features/stories/NarrationBar'
import { stories } from '@/data'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/ui/drawer'
import { MobileTabBar } from './LensSwitcher'

export function InvestigationBoard() {
  useURLSync()
  useMobileDetect()
  const lens = useUIStore((s) => s.lens)
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const isMobile = useUIStore((s) => s.isMobile)

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
        {sidebarOpen && lens === 'graph' && !isMobile && (
          <aside className="w-[280px] shrink-0 border-r border-white/[0.08] bg-[#0c0c10] overflow-y-auto">
            <FilterPanel />
            <div className="border-t border-white/[0.05]" />
            <PathFinder />
          </aside>
        )}

        {/* Mobile drawer for filters */}
        {isMobile && lens === 'graph' && (
          <Drawer
            open={sidebarOpen}
            onOpenChange={(open) => {
              useUIStore.getState().toggleSidebar(open)
            }}
          >
            <DrawerContent className="bg-[#0c0c10] border-white/[0.05] max-h-[80vh]">
              <DrawerHeader className="sr-only">
                <DrawerTitle>Filters</DrawerTitle>
              </DrawerHeader>
              <div className="overflow-y-auto">
                <FilterPanel />
                <div className="border-t border-white/[0.05]" />
                <PathFinder />
              </div>
            </DrawerContent>
          </Drawer>
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
        <WikiDetailPanel />
      </div>

      {/* Trail bar — desktop only (mobile has limited space) */}
      {!isMobile && <TrailBar />}

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

      {/* Mobile bottom tab bar */}
      {isMobile && <MobileTabBar />}
    </div>
  )
}
