import { useEffect, useMemo, useRef, useState } from 'react'
import { GeoJSON } from 'react-leaflet'
import { useTimelineStore } from '@/stores/useTimelineStore'
import type { TerritorySnapshot } from '@/types'

interface TerritoryLayerProps {
  snapshots: TerritorySnapshot[]
}

// Map status values to fill colors
const STATUS_COLORS: Record<string, string> = {
  controlled: '#c0392b',
  allied: '#e89040',
  contested: '#f1c40f',
  lost: '#7f8c8d',
  core: '#c0392b',
  province: '#e74c3c',
  client: '#e89040',
}

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? '#888888'
}

// Fade duration must match the CSS transition on `.territory-path`.
const FADE_MS = 500

type Phase = 'entering' | 'in' | 'out'

interface Entry {
  key: string
  snap: TerritorySnapshot
  phase: Phase
}

function snapKey(snap: TerritorySnapshot): string {
  return `${snap.id}-${snap.year}`
}

/**
 * Renders the territory polygons for the current year and cross-fades between
 * eras: when a region's snapshot changes, the outgoing border fades out while
 * the incoming one fades in, so the empire visibly flows rather than blinking
 * out and back. Opacity is driven through the `style` prop (react-leaflet
 * applies it via setStyle) and animated by a CSS transition on the paths.
 */
export function TerritoryLayer({ snapshots }: TerritoryLayerProps) {
  const currentYear = useTimelineStore((s) => s.currentYear)

  // The snapshot that should be showing for each region at the current year.
  const active = useMemo(() => {
    const eligible = snapshots.filter((s) => s.year <= currentYear)
    const latestByRegion = new Map<string, TerritorySnapshot>()
    for (const snap of eligible) {
      const existing = latestByRegion.get(snap.id)
      if (!existing || snap.year > existing.year) latestByRegion.set(snap.id, snap)
    }
    return Array.from(latestByRegion.values())
  }, [snapshots, currentYear])

  // Stable trigger — only changes when the *set* of visible snapshots changes,
  // not on every year tick within a snapshot's range.
  const activeKeys = active.map(snapKey).sort().join('|')

  const [entries, setEntries] = useState<Entry[]>([])
  const removalTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Reconcile mounted entries with the active set: add incoming as `entering`,
  // mark departed as `out` (kept mounted so they can fade), revive any `out`
  // entry that became active again (fast scrubbing back and forth).
  useEffect(() => {
    setEntries((prev) => {
      const prevByKey = new Map(prev.map((e) => [e.key, e]))
      const activeKeySet = new Set(active.map(snapKey))
      const next: Entry[] = []

      for (const snap of active) {
        const key = snapKey(snap)
        const existing = prevByKey.get(key)
        if (existing) {
          next.push(existing.phase === 'out' ? { ...existing, phase: 'in' } : existing)
        } else {
          next.push({ key, snap, phase: 'entering' })
        }
      }
      for (const e of prev) {
        if (!activeKeySet.has(e.key)) {
          next.push(e.phase === 'out' ? e : { ...e, phase: 'out' })
        }
      }
      return next
    })
    // Keyed on the set signature, not the `active` array identity, so this
    // doesn't re-run on every year tick within a snapshot's range.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKeys])

  // Promote `entering` → `in` after two frames so the browser paints the
  // transparent start state first and the opacity transition actually runs.
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

  // Remove `out` entries once their fade-out has finished; cancel the timer if
  // an entry was revived back to `in`.
  useEffect(() => {
    const timers = removalTimers.current
    for (const e of entries) {
      if (e.phase === 'out' && !timers.has(e.key)) {
        const t = setTimeout(() => {
          timers.delete(e.key)
          setEntries((prev) => prev.filter((x) => x.key !== e.key))
        }, FADE_MS + 60)
        timers.set(e.key, t)
      }
    }
    for (const [key, t] of timers) {
      if (!entries.some((e) => e.key === key && e.phase === 'out')) {
        clearTimeout(t)
        timers.delete(key)
      }
    }
  }, [entries])

  useEffect(() => {
    const timers = removalTimers.current
    return () => {
      for (const t of timers.values()) clearTimeout(t)
      timers.clear()
    }
  }, [])

  return (
    <>
      {entries.map(({ key, snap, phase }) => {
        if (!snap.boundaries) return null
        const hidden = phase !== 'in'
        const targetFill = snap.year >= -300 ? 0.35 : 0.5
        return (
          <GeoJSON
            key={key}
            data={snap.boundaries}
            interactive={false}
            pane="basePolygons"
            style={{
              color: '#fff',
              fillColor: getStatusColor(snap.status),
              fillOpacity: hidden ? 0 : targetFill,
              weight: 1.5,
              opacity: hidden ? 0 : 0.5,
              pane: 'basePolygons',
              className: 'territory-path',
            }}
          />
        )
      })}
    </>
  )
}
