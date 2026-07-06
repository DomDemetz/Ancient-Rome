import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useUIStore } from '@/stores/useUIStore'

// Keep in sync with TimelinePlayer's domain.
const MIN_YEAR = -753
const MAX_YEAR = 1453

export function useURLSync() {
  const [, setSearchParams] = useSearchParams()
  const select = useSelectionStore((s) => s.select)
  const setYear = useTimelineStore((s) => s.setYear)
  const switchLens = useUIStore((s) => s.switchLens)
  const atlasMode = useUIStore((s) => s.atlasMode)

  // Read URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    const yearParam = params.get('year')
    if (yearParam) {
      const y = Number(yearParam)
      if (Number.isFinite(y)) {
        setYear(Math.max(MIN_YEAR, Math.min(MAX_YEAR, Math.round(y))))
      }
    }

    const entityId = params.get('entity')
    if (entityId) select(entityId)

    if (!atlasMode) {
      const lens = params.get('lens')
      if (lens && ['graph', 'map', 'timeline', 'stats'].includes(lens)) {
        switchLens(lens as 'graph' | 'map' | 'timeline' | 'stats')
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Write URL on state changes — single batched update to prevent race
  useEffect(() => {
    let rafId: number | null = null

    function scheduleSync() {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        const selectedId = useSelectionStore.getState().selectedId
        const { currentYear } = useTimelineStore.getState()
        const { lens, atlasMode: isAtlas, activeStoryId } = useUIStore.getState()
        setSearchParams(
          (prev) => {
            if (selectedId) prev.set('entity', selectedId)
            else prev.delete('entity')
            prev.set('year', String(currentYear))
            if (activeStoryId) prev.set('story', activeStoryId)
            else prev.delete('story')
            if (!isAtlas) prev.set('lens', lens)
            else prev.delete('lens')
            return prev
          },
          { replace: true },
        )
      })
    }

    const unsubs = [
      useSelectionStore.subscribe(scheduleSync),
      useUIStore.subscribe(scheduleSync),
      // Sync the year too, but not on every playback frame — only once the user
      // has stopped (or just paused), so the URL stays a shareable snapshot
      // without thrashing during autoplay.
      useTimelineStore.subscribe((s, prevState) => {
        if (s.playing) return
        if (s.currentYear !== prevState.currentYear || prevState.playing) scheduleSync()
      }),
    ]
    return () => {
      unsubs.forEach((u) => u())
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [setSearchParams])
}
