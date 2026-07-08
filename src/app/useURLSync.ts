import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useUIStore } from '@/stores/useUIStore'
import { useMapNavStore } from '@/stores/useMapNavStore'
import { ALL_LAYER_KEYS, useMapLayerStore } from '@/stores/useMapLayerStore'

// Keep in sync with TimelinePlayer's domain.
const MIN_YEAR = -753
const MAX_YEAR = 1453

/** Active layers as a compact URL value: showEmpires → empires.
 *  A shared link must carry the SCENE — recipients used to get their own
 *  default layers, so "look at the 1223 world" opened as Roman roads. */
export function layersToParam(): string {
  const s = useMapLayerStore.getState() as unknown as Record<string, unknown>
  return ALL_LAYER_KEYS.filter((k) => s[k])
    .map((k) => k.replace(/^show/, '').toLowerCase())
    .join(',')
}

export function datasetsToParam(): string {
  const ds = useMapLayerStore.getState().datasetState
  return Object.keys(ds)
    .filter((id) => ds[id]?.show)
    .join(',')
}

export function useURLSync() {
  const [, setSearchParams] = useSearchParams()
  const select = useSelectionStore((s) => s.select)
  const setYear = useTimelineStore((s) => s.setYear)
  const switchLens = useUIStore((s) => s.switchLens)
  const atlasMode = useUIStore((s) => s.atlasMode)
  const flyTo = useMapNavStore((s) => s.flyTo)

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

    const latParam = params.get('lat')
    const lngParam = params.get('lng')
    const zoomParam = params.get('z')
    if (latParam && lngParam) {
      const lat = Number(latParam)
      const lng = Number(lngParam)
      const zoom = zoomParam ? Number(zoomParam) : 5
      if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(zoom)) {
        flyTo(lat, lng, zoom)
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
        const mapView = useMapNavStore.getState().mapView
        setSearchParams(
          (prev) => {
            if (selectedId) prev.set('entity', selectedId)
            else prev.delete('entity')
            prev.set('year', String(currentYear))
            if (activeStoryId) prev.set('story', activeStoryId)
            else prev.delete('story')
            if (!isAtlas) prev.set('lens', lens)
            else prev.delete('lens')
            if (mapView) {
              prev.set('lat', mapView.lat.toFixed(2))
              prev.set('lng', mapView.lng.toFixed(2))
              prev.set('z', String(mapView.zoom))
            }
            // the layer set IS the scene — carry it so shared links replay it
            const layers = layersToParam()
            if (layers) prev.set('layers', layers)
            else prev.delete('layers')
            const ds = datasetsToParam()
            if (ds) prev.set('ds', ds)
            else prev.delete('ds')
            return prev
          },
          { replace: true },
        )
      })
    }

    const unsubs = [
      useSelectionStore.subscribe(scheduleSync),
      useUIStore.subscribe(scheduleSync),
      // layer toggles change the shareable scene; data loads also fire this
      // subscription, but scheduleSync is rAF-batched and the write is a
      // history.replace, so the churn costs one batched update per frame
      useMapLayerStore.subscribe(scheduleSync),
      // Sync the year too, but not on every playback frame — only once the user
      // has stopped (or just paused), so the URL stays a shareable snapshot
      // without thrashing during autoplay.
      useTimelineStore.subscribe((s, prevState) => {
        if (s.playing) return
        if (s.currentYear !== prevState.currentYear || prevState.playing) scheduleSync()
      }),
      useMapNavStore.subscribe((s, prevState) => {
        if (s.mapView !== prevState.mapView) scheduleSync()
      }),
    ]
    return () => {
      unsubs.forEach((u) => u())
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [setSearchParams])
}
