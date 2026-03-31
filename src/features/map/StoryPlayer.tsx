import { useState, useCallback, useEffect } from 'react'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useMapLayerStore, ALL_LAYER_KEYS } from '@/stores/useMapLayerStore'
import { useUIStore } from '@/stores/useUIStore'

export interface StoryStep {
  id: string
  title: string
  content: string
  entityIds?: string[]
  year: number
  layers?: string[]
  mapCenter?: [number, number]
  mapZoom?: number
}

export interface Story {
  id: string
  title: string
  description: string
  steps: StoryStep[]
  tags: string[]
}

interface StoryPlayerProps {
  story: Story
  onClose: () => void
  onNavigate?: (center: [number, number], zoom: number) => void
}

function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year)} BC`
  return `${year} AD`
}

export function StoryPlayer({ story, onClose, onNavigate }: StoryPlayerProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const setYear = useTimelineStore((s) => s.setYear)
  const isMobile = useUIStore((s) => s.isMobile)

  const step = story.steps[currentStep]
  const isFirst = currentStep === 0
  const isLast = currentStep === story.steps.length - 1

  // Apply step state when step changes
  useEffect(() => {
    if (!step) return
    setYear(step.year)

    // Activate layers for this step
    if (step.layers && step.layers.length > 0) {
      const update: Record<string, boolean> = {}
      for (const key of ALL_LAYER_KEYS) {
        update[key] = step.layers.includes(key)
      }
      useMapLayerStore.setState({ ...update, activePreset: 'custom' as const })

      // Trigger loading for enabled layers
      const state = useMapLayerStore.getState()
      for (const layerKey of step.layers) {
        const dataKey =
          layerKey.replace('show', '').charAt(0).toLowerCase() +
          layerKey.replace('show', '').slice(1) +
          'Data'
        if (!(state as unknown as Record<string, unknown>)[dataKey]) {
          const toggleKey = ('toggle' + layerKey.replace('show', '')) as keyof typeof state
          const fn = state[toggleKey]
          if (typeof fn === 'function') {
            // Set show back to false so toggle loads, then back to true
            useMapLayerStore.setState({ [layerKey]: false } as Record<string, boolean>)
            ;(fn as () => void)()
          }
        }
      }
    }

    // Navigate map
    if (step.mapCenter && onNavigate) {
      onNavigate(step.mapCenter, step.mapZoom || 5)
    }
  }, [step, setYear, onNavigate])

  const goNext = useCallback(() => {
    if (!isLast) setCurrentStep((s) => s + 1)
  }, [isLast])

  const goPrev = useCallback(() => {
    if (!isFirst) setCurrentStep((s) => s - 1)
  }, [isFirst])

  if (!step) return null

  return (
    <div
      className={`absolute left-1/2 -translate-x-1/2 z-[1000] w-[480px] ${
        isMobile ? 'bottom-4 max-w-[calc(100vw-1.5rem)]' : 'bottom-20 max-w-[calc(100vw-2rem)]'
      }`}
      style={{ pointerEvents: 'all' }}
    >
      <div className="rounded-lg border border-amber-700/40 bg-[#0f0a1a]/95 backdrop-blur-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-amber-400/70 text-[10px] font-bold uppercase tracking-wider">
              Story
            </span>
            <span className="text-white/90 text-sm font-bold">{story.title}</span>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/80 text-lg leading-none"
          >
            &times;
          </button>
        </div>

        {/* Step content */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-amber-400 text-xs font-bold">{formatYear(step.year)}</span>
            <span className="text-white/80 text-sm font-semibold">{step.title}</span>
            <span className="ml-auto text-white/30 text-[10px]">
              {currentStep + 1}/{story.steps.length}
            </span>
          </div>
          <div
            className="text-white/70 text-xs leading-relaxed max-h-40 overflow-y-auto"
            style={{ whiteSpace: 'pre-wrap' }}
          >
            {step.content}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/10">
          <button
            onClick={goPrev}
            disabled={isFirst}
            className={[
              'px-3 py-1 text-xs rounded border transition-colors',
              isMobile ? 'min-h-[44px] min-w-[44px]' : '',
              isFirst
                ? 'border-white/10 text-white/20 cursor-not-allowed'
                : 'border-white/20 text-white/70 hover:bg-white/10 active:bg-white/15',
            ].join(' ')}
          >
            &larr; Prev
          </button>

          {/* Step dots */}
          <div className="flex gap-1.5">
            {story.steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={[
                  'rounded-full transition-colors',
                  isMobile ? 'w-2.5 h-2.5' : 'w-1.5 h-1.5',
                  i === currentStep
                    ? 'bg-amber-400'
                    : 'bg-white/20 hover:bg-white/40 active:bg-white/40',
                ].join(' ')}
              />
            ))}
          </div>

          <button
            onClick={isLast ? onClose : goNext}
            className={`px-3 py-1 text-xs rounded border border-amber-700/50 text-amber-200/80 hover:bg-amber-900/40 active:bg-amber-900/50 transition-colors ${
              isMobile ? 'min-h-[44px] min-w-[44px]' : ''
            }`}
          >
            {isLast ? 'Finish' : 'Next \u2192'}
          </button>
        </div>
      </div>
    </div>
  )
}
