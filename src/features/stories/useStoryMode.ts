import { useState, useCallback } from 'react'
import { useFilterStore } from '@/stores/useFilterStore'
import { useSelectionStore } from '@/stores/useSelectionStore'
import type { Story, StoryStep } from '@/types'

interface StoryModeState {
  activeStory: Story | null
  stepIndex: number
}

export function useStoryMode() {
  const [state, setState] = useState<StoryModeState>({ activeStory: null, stepIndex: 0 })

  const saveSnapshot = useFilterStore((s) => s.saveSnapshot)
  const restoreSnapshot = useFilterStore((s) => s.restoreSnapshot)
  const select = useSelectionStore((s) => s.select)

  const currentStep: StoryStep | null = state.activeStory
    ? (state.activeStory.steps[state.stepIndex] ?? null)
    : null

  const isActive = state.activeStory !== null
  const isLastStep =
    state.activeStory !== null && state.stepIndex === state.activeStory.steps.length - 1

  const enter = useCallback(
    (story: Story) => {
      saveSnapshot()
      const firstStep = story.steps[0]
      setState({ activeStory: story, stepIndex: 0 })
      if (firstStep?.entityIds?.[0]) {
        select(firstStep.entityIds[0])
      }
    },
    [saveSnapshot, select],
  )

  const exit = useCallback(() => {
    restoreSnapshot()
    setState({ activeStory: null, stepIndex: 0 })
  }, [restoreSnapshot])

  const nextStep = useCallback(() => {
    let entityToSelect: string | undefined
    setState((prev) => {
      if (!prev.activeStory) return prev
      const nextIndex = Math.min(prev.stepIndex + 1, prev.activeStory.steps.length - 1)
      entityToSelect = prev.activeStory.steps[nextIndex]?.entityIds?.[0]
      return { ...prev, stepIndex: nextIndex }
    })
    if (entityToSelect) select(entityToSelect)
  }, [select])

  const prevStep = useCallback(() => {
    let entityToSelect: string | undefined
    setState((prev) => {
      if (!prev.activeStory) return prev
      const prevIndex = Math.max(prev.stepIndex - 1, 0)
      entityToSelect = prev.activeStory.steps[prevIndex]?.entityIds?.[0]
      return { ...prev, stepIndex: prevIndex }
    })
    if (entityToSelect) select(entityToSelect)
  }, [select])

  return {
    activeStory: state.activeStory,
    stepIndex: state.stepIndex,
    currentStep,
    isActive,
    isLastStep,
    enter,
    exit,
    nextStep,
    prevStep,
  }
}
