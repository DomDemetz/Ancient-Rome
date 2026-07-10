import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSelectionStore } from '@/stores/useSelectionStore'
import {
  useTimelineStore,
  ROMAN_MIN,
  ROMAN_MAX,
  FULL_MIN,
  FULL_MAX,
} from '@/stores/useTimelineStore'
import { useUIStore } from '@/stores/useUIStore'
import { useMapNavStore } from '@/stores/useMapNavStore'
import { ALL_LAYER_KEYS, useMapLayerStore } from '@/stores/useMapLayerStore'

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
        const { fullTimeline } = useTimelineStore.getState()
        const lo = fullTimeline ? FULL_MIN : ROMAN_MIN
        const hi = fullTimeline ? FULL_MAX : ROMAN_MAX
        setYear(Math.max(lo, Math.min(hi, Math.round(y))))
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
        // NEVER write an unchanged URL. The layer-store subscription fires on
        // every data load, and identical replaceState churn trips Safari's
        // hard quota (~100/30s) — the thrown SecurityError put the whole app
        // in an error-remount loop on iPhones while Chrome showed nothing.
        const next = new URLSearchParams(window.location.search)
        if (selectedId) next.set('entity', selectedId)
        else next.delete('entity')
        next.set('year', String(currentYear))
        if (activeStoryId) next.set('story', activeStoryId)
        else next.delete('story')
        if (!isAtlas) next.set('lens', lens)
        else next.delete('lens')
        if (mapView) {
          next.set('lat', mapView.lat.toFixed(2))
          next.set('lng', mapView.lng.toFixed(2))
          next.set('z', String(mapView.zoom))
        }
        const layers = layersToParam()
        if (layers) next.set('layers', layers)
        else next.delete('layers')
        const ds = datasetsToParam()
        if (ds) next.set('ds', ds)
        else next.delete('ds')
        if (next.toString() === new URLSearchParams(window.location.search).toString()) return
        setSearchParams(next, { replace: true })
      })
    }

    const unsubs = [
      useSelectionStore.subscribe(scheduleSync),
      useUIStore.subscribe(scheduleSync),
      // layer toggles change the shareable scene; data loads also fire this
      // subscription, but the identical-URL guard above makes those no-ops
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
