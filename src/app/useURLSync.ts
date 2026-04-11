import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { useUIStore } from '@/stores/useUIStore'

export function useURLSync() {
  const [searchParams, setSearchParams] = useSearchParams()
  const select = useSelectionStore((s) => s.select)
  const switchLens = useUIStore((s) => s.switchLens)
  const atlasMode = useUIStore((s) => s.atlasMode)

  // Read URL on mount
  useEffect(() => {
    const entityId = searchParams.get('entity')
    if (entityId) select(entityId)
    if (!atlasMode) {
      const lens = searchParams.get('lens') as 'graph' | 'map' | 'timeline' | 'stats' | null
      if (lens) switchLens(lens)
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
        const { lens, atlasMode: isAtlas } = useUIStore.getState()
        setSearchParams(
          (prev) => {
            if (selectedId) prev.set('entity', selectedId)
            else prev.delete('entity')
            if (!isAtlas) prev.set('lens', lens)
            else prev.delete('lens')
            return prev
          },
          { replace: true },
        )
      })
    }

    const unsubs = [useSelectionStore.subscribe(scheduleSync), useUIStore.subscribe(scheduleSync)]
    return () => {
      unsubs.forEach((u) => u())
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [setSearchParams])
}
