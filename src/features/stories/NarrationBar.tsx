import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '@/ui/button'
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

  return (
    <div className="shrink-0 border-t border-border bg-bg-card px-4 py-3">
      <div className="max-w-4xl mx-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        {/* Title + counter */}
        <div className="shrink-0">
          <p className="text-xs text-text-secondary">{story.title}</p>
          <p className="text-xs text-accent-gold font-medium">
            Step {stepIndex + 1} / {totalSteps}
          </p>
        </div>

        {/* Step content */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-text-primary mb-0.5">{currentStep.title}</p>
          <p className="text-xs text-text-secondary line-clamp-2">{currentStep.content}</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onPrev}
            disabled={stepIndex === 0}
            aria-label="Previous step"
          >
            <ChevronLeft className="size-4" />
          </Button>

          {isLastStep ? (
            <Button size="sm" onClick={onExit}>
              Finish
            </Button>
          ) : (
            <Button size="sm" onClick={onNext}>
              Next <ChevronRight className="size-3.5 ml-1" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onExit}
            aria-label="Exit story"
            className="text-text-secondary hover:text-text-primary"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
