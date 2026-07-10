import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TopBar } from './TopBar'
import { DetailPanel } from '@/features/detail/DetailPanel'
import { WikiDetailPanel } from '@/features/detail/WikiDetailPanel'
import { useURLSync } from '@/app/useURLSync'
import { useMobileDetect } from '@/app/useMobileDetect'
import { MapView } from '@/features/map/MapView'
import { ErrorBoundary } from '@/app/ErrorBoundary'
import { useStoryMode } from '@/features/stories/useStoryMode'
import { NarrationBar } from '@/features/stories/NarrationBar'
import { stories } from '@/data'

export function InvestigationBoard() {
  useURLSync()
  useMobileDetect()

  const storyMode = useStoryMode()
  const [searchParams] = useSearchParams()

  // Auto-start story from URL param (e.g., /?story=fall-of-republic)
  useEffect(() => {
    const storyId = searchParams.get('story')
    if (storyId && !storyMode.isActive) {
      const story = stories.find((s) => s.id === storyId)
      if (story) storyMode.enter(story)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-dvh">
      <TopBar storyMode={storyMode} />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden relative">
          <ErrorBoundary>
            <MapView />
          </ErrorBoundary>
        </div>

        {/* Detail panels — shown when an entity is selected; self-hide when
            nothing is selected. */}
        <DetailPanel />
        <WikiDetailPanel />
      </div>

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
