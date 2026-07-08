import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '@/ui/button'
import { useUIStore } from '@/stores/useUIStore'
import type { Story, StoryStep } from '@/types'

interface NarrationBarProps {
  story: Story
  stepIndex: number
  currentStep: StoryStep
  isLastStep: boolean
  onNext: () => void
  onPrev: () => void
  onExit: () => void
}

export function NarrationBar({
  story,
  stepIndex,
  currentStep,
  isLastStep,
  onNext,
  onPrev,
  onExit,
}: NarrationBarProps) {
  const totalSteps = story.steps.length
  const isMobile = useUIStore((s) => s.isMobile)

  const touchTarget = isMobile ? 'min-h-[44px] min-w-[44px]' : ''

  return (
    <div
      className="shrink-0 bg-black/80 backdrop-blur-2xl border-t border-white/[0.05] px-4 py-3"
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="max-w-4xl mx-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        {/* Title + counter */}
        <div className="shrink-0">
          <p className="text-xs text-slate-400">{story.title}</p>
          <p className="text-xs text-amber-500 font-medium">
            Step {stepIndex + 1} / {totalSteps}
          </p>
        </div>

        {/* Step content. The narration IS the story — line-clamp-2 cut every
            step mid-sentence (the longest runs ~1,800 chars and lost 90% of
            its text with no way to read it). Show it fully up to ~5 lines,
            scroll inside for the monsters, keep the choreographed map view. */}
        <div className="flex-1 min-w-0">
          <p className="font-serif italic font-bold text-[15px] text-amber-50/95 mb-0.5">{currentStep.title}</p>
          <p className="text-xs text-slate-400 leading-relaxed max-h-[5.5rem] overflow-y-auto pr-2">
            {currentStep.content}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onPrev}
            disabled={stepIndex === 0}
            aria-label="Previous step"
            className={`active:scale-95 transition-transform ${touchTarget}`}
          >
            <ChevronLeft className="size-4" />
          </Button>

          {isLastStep ? (
            <Button
              size="sm"
              onClick={onExit}
              className={`active:scale-95 transition-transform ${touchTarget}`}
            >
              Finish
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onNext}
              className={`active:scale-95 transition-transform bg-amber-600 hover:bg-amber-500 text-white ${touchTarget}`}
            >
              Next <ChevronRight className="size-3.5 ml-1" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onExit}
            aria-label="Exit story"
            className={`text-slate-400 hover:text-slate-100 ${touchTarget}`}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
