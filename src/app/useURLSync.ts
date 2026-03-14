import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { useUIStore } from '@/stores/useUIStore'

export function useURLSync() {
  const [searchParams, setSearchParams] = useSearchParams()
  const select = useSelectionStore((s) => s.select)
  const switchLens = useUIStore((s) => s.switchLens)

  // Read URL on mount
  useEffect(() => {
    const entityId = searchParams.get('entity')
    const lens = searchParams.get('lens') as 'graph' | 'map' | 'timeline' | 'stats' | null
    if (entityId) select(entityId)
    if (lens) switchLens(lens)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Write URL on state changes
  useEffect(() => {
    const unsubs = [
      useSelectionStore.subscribe((state) => {
        setSearchParams(
          (prev) => {
            if (state.selectedId) prev.set('entity', state.selectedId)
            else prev.delete('entity')
            return prev
          },
          { replace: true },
        )
      }),
      useUIStore.subscribe((state) => {
        setSearchParams(
          (prev) => {
            prev.set('lens', state.lens)
            return prev
          },
          { replace: true },
        )
      }),
    ]
    return () => unsubs.forEach((u) => u())
  }, [setSearchParams])
}
