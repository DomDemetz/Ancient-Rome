import { useCallback, useRef } from 'react'
import { useState } from 'react'
import { useFilterStore } from '@/stores/useFilterStore'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useMapNavStore } from '@/stores/useMapNavStore'
import { useMapLayerStore, ALL_LAYER_KEYS } from '@/stores/useMapLayerStore'
import { useUIStore } from '@/stores/useUIStore'
import type { Story, StoryStep } from '@/types'

interface StoryModeState {
  activeStory: Story | null
  stepIndex: number
}

// Snapshot of map/timeline state captured when a story begins, so exiting the
// story returns the viewer to where they were.
interface ViewSnapshot {
  year: number
  layers: string[]
}

export function useStoryMode() {
  const [state, setState] = useState<StoryModeState>({ activeStory: null, stepIndex: 0 })
  const viewSnapshot = useRef<ViewSnapshot | null>(null)

  const saveSnapshot = useFilterStore((s) => s.saveSnapshot)
  const restoreSnapshot = useFilterStore((s) => s.restoreSnapshot)
  const select = useSelectionStore((s) => s.select)

  const currentStep: StoryStep | null = state.activeStory
    ? (state.activeStory.steps[state.stepIndex] ?? null)
    : null

  const isActive = state.activeStory !== null
  const isLastStep =
    state.activeStory !== null && state.stepIndex === state.activeStory.steps.length - 1

  // Apply a step's authored choreography: timeline year, map camera, active
  // layers, and the highlighted entity. Reads/writes stores via getState so it
  // stays a stable callback that doesn't re-render on every store change.
  const applyStep = useCallback(
    (step: StoryStep | undefined) => {
      if (!step) return
      if (typeof step.year === 'number') {
        useTimelineStore.getState().setYear(step.year)
      }
      if (step.mapCenter) {
        const [lat, lng] = step.mapCenter
        useMapNavStore.getState().flyTo(lat, lng, step.mapZoom)
      }
      if (step.layers) {
        useMapLayerStore.getState().setLayers(step.layers)
      }
      if (step.entityIds?.[0]) {
        select(step.entityIds[0])
      }
    },
    [select],
  )

  const enter = useCallback(
    (story: Story) => {
      saveSnapshot()
      // Remember the pre-story timeline year and visible layers to restore on exit.
      const layerState = useMapLayerStore.getState()
      viewSnapshot.current = {
        year: useTimelineStore.getState().currentYear,
        layers: ALL_LAYER_KEYS.filter((k) => layerState[k]),
      }
      setState({ activeStory: story, stepIndex: 0 })
      // Mirror into the UI store so useURLSync writes ?story from its single
      // URL-write path — reflecting the tour so it can be copied and reloaded.
      useUIStore.getState().setActiveStoryId(story.id)
      applyStep(story.steps[0])
    },
    [saveSnapshot, applyStep],
  )

  const exit = useCallback(() => {
    restoreSnapshot()
    const snap = viewSnapshot.current
    if (snap) {
      useTimelineStore.getState().setYear(snap.year)
      useMapLayerStore.getState().setLayers(snap.layers)
      viewSnapshot.current = null
    }
    setState({ activeStory: null, stepIndex: 0 })
    useUIStore.getState().setActiveStoryId(null)
  }, [restoreSnapshot])

  const nextStep = useCallback(() => {
    let target: StoryStep | undefined
    setState((prev) => {
      if (!prev.activeStory) return prev
      const nextIndex = Math.min(prev.stepIndex + 1, prev.activeStory.steps.length - 1)
      target = prev.activeStory.steps[nextIndex]
      return { ...prev, stepIndex: nextIndex }
    })
    applyStep(target)
  }, [applyStep])

  const prevStep = useCallback(() => {
    let target: StoryStep | undefined
    setState((prev) => {
      if (!prev.activeStory) return prev
      const prevIndex = Math.max(prev.stepIndex - 1, 0)
      target = prev.activeStory.steps[prevIndex]
      return { ...prev, stepIndex: prevIndex }
    })
    applyStep(target)
  }, [applyStep])

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
