import { useEffect, useMemo, useRef, useState } from 'react'
import { GeoJSON } from 'react-leaflet'
import { useTimelineStore } from '@/stores/useTimelineStore'
import type { TerritorySnapshot } from '@/types'

interface TerritoryLayerProps {
  snapshots: TerritorySnapshot[]
}

// Map status values to fill colors
// Muted imperial crimson family — Rome keeps the red identity but wears
// the same earth-mineral finish as the world's other polities.
const STATUS_COLORS: Record<string, string> = {
  controlled: '#a35d50',
  allied: '#b08a5a',
  contested: '#b0975a',
  lost: '#7d8585',
  core: '#a35d50',
  province: '#a86558',
  client: '#b08a5a',
}

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? '#888888'
}

// Fade duration must match the CSS transition on `.territory-path`.
const FADE_MS = 450

// Phases of a snapshot polygon as it cross-fades. The fills are opaque (the
// pane applies the group translucency), so keeping an opaque fill over the
// shared core at all times keeps the colour perfectly constant:
//   entering → in:      new border fades its fill in (gained land appears)
//   in → holding:       outgoing border stays fully opaque while the new one
//                       fades in, so the core is never uncovered
//   holding → out:      once the new border is in, the old fades out (lost
//                       land recedes); then it is removed
type Phase = 'entering' | 'in' | 'holding' | 'out'

interface Entry {
  key: string
  snap: TerritorySnapshot
  phase: Phase
}

function snapKey(snap: TerritorySnapshot): string {
  return `${snap.id}-${snap.year}`
}

export function TerritoryLayer({ snapshots }: TerritoryLayerProps) {
  const currentYear = useTimelineStore((s) => s.currentYear)
  const playing = useTimelineStore((s) => s.playing)

  // Transition-rate governor. The territory data has war-level resolution
  // (241 breakpoints; gaps down to 1 year), so raw playback can demand up
  // to 50 snapshot swaps/second at 1x — each a ~640-point polygon cross-
  // fade, which stack up faster than they finish and stutter the tail of
  // the timeline. During playback we admit a new territory year at most
  // every 400ms (longer than the fade); paused/scrubbing stays exact.
  const [territoryYear, setTerritoryYear] = useState(currentYear)
  const lastSwap = useRef(0)
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!playing) {
      if (pending.current) clearTimeout(pending.current)
      pending.current = null
      setTerritoryYear(currentYear)
      lastSwap.current = Date.now()
      return
    }
    const since = Date.now() - lastSwap.current
    if (since >= 400) {
      lastSwap.current = Date.now()
      setTerritoryYear(currentYear)
    } else if (!pending.current) {
      pending.current = setTimeout(() => {
        pending.current = null
        lastSwap.current = Date.now()
        setTerritoryYear(useTimelineStore.getState().currentYear)
      }, 400 - since)
    }
    return () => {
      if (pending.current) {
        clearTimeout(pending.current)
        pending.current = null
      }
    }
  }, [currentYear, playing])

  // The snapshot that should be showing for each region at the current year.
  const active = useMemo(() => {
    const eligible = snapshots.filter((s) => s.year <= territoryYear)
    const latestByRegion = new Map<string, TerritorySnapshot>()
    for (const snap of eligible) {
      const existing = latestByRegion.get(snap.id)
      if (!existing || snap.year > existing.year) latestByRegion.set(snap.id, snap)
    }
    // A region whose latest state is a "fall" (status 'lost') plays the recede,
    // then disappears — so the fallen Western Empire doesn't linger on the map
    // through the Byzantine centuries after 476.
    return Array.from(latestByRegion.values()).filter(
      (snap) => !(snap.status === 'lost' && territoryYear > snap.year + 30),
    )
  }, [snapshots, territoryYear])

  // Only changes when the *set* of visible snapshots changes.
  const activeKeys = active.map(snapKey).sort().join('|')

  const [entries, setEntries] = useState<Entry[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Reconcile mounted entries with the active set.
  useEffect(() => {
    setEntries((prev) => {
      const prevByKey = new Map(prev.map((e) => [e.key, e]))
      const activeKeySet = new Set(active.map(snapKey))
      const next: Entry[] = []

      for (const snap of active) {
        const key = snapKey(snap)
        const existing = prevByKey.get(key)
        if (existing) {
          // Re-selected while fading away → snap it back to fully shown.
          next.push(
            existing.phase === 'out' || existing.phase === 'holding'
              ? { ...existing, phase: 'in' }
              : existing,
          )
        } else {
          next.push({ key, snap, phase: 'entering' })
        }
      }
      // Departed borders: hold them opaque first so the core stays covered
      // while the incoming border fades in.
      for (const e of prev) {
        if (!activeKeySet.has(e.key)) {
          next.push(e.phase === 'out' || e.phase === 'holding' ? e : { ...e, phase: 'holding' })
        }
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKeys])

  // Promote `entering` → `in` after two frames so the fill-in transition runs.
  useEffect(() => {
    if (!entries.some((e) => e.phase === 'entering')) return
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setEntries((prev) => prev.map((e) => (e.phase === 'entering' ? { ...e, phase: 'in' } : e)))
      })
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [entries])

  // Drive the timed part of the sequence: hold → out (after the incoming has
  // faded in), then out → removed (after it has faded out).
  useEffect(() => {
    const map = timers.current
    for (const e of entries) {
      if (e.phase === 'holding' && !map.has(e.key)) {
        const t = setTimeout(() => {
          map.delete(e.key)
          setEntries((prev) => prev.map((x) => (x.key === e.key ? { ...x, phase: 'out' } : x)))
          // +80ms margin: let the incoming fill finish before the old one
          // starts fading, so the core is never briefly uncovered.
        }, FADE_MS + 80)
        map.set(e.key, t)
      } else if (e.phase === 'out' && !map.has(e.key)) {
        const t = setTimeout(() => {
          map.delete(e.key)
          setEntries((prev) => prev.filter((x) => x.key !== e.key))
        }, FADE_MS + 60)
        map.set(e.key, t)
      }
    }
    // Cancel timers for entries that were revived back to `in`.
    for (const [key, t] of map) {
      const e = entries.find((x) => x.key === key)
      if (!e || (e.phase !== 'holding' && e.phase !== 'out')) {
        clearTimeout(t)
        map.delete(key)
      }
    }
  }, [entries])

  useEffect(() => {
    const map = timers.current
    return () => {
      for (const t of map.values()) clearTimeout(t)
      map.clear()
    }
  }, [])

  return (
    <>
      {entries.map(({ key, snap, phase }) => {
        if (!snap.boundaries) return null
        const shown = phase === 'in' || phase === 'holding'
        return (
          <GeoJSON
            key={key}
            data={snap.boundaries}
            interactive={false}
            pane="territoryFill"
            style={{
              // darkened self-tone edge, same formula as the world layer
              color: '#5f362e',
              fillColor: getStatusColor(snap.status),
              // Opaque fill — the pane supplies the translucency, so overlapping
              // snapshots never darken or wash out.
              fillOpacity: shown ? 1 : 0,
              weight: 1,
              opacity: shown ? 0.9 : 0,
              pane: 'territoryFill',
              className: 'territory-path',
            }}
          />
        )
      })}
    </>
  )
}
