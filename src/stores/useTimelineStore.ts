import { create } from 'zustand'

interface TimelineState {
  playing: boolean
  currentYear: number
  speed: number
  isScrubbing: boolean
  /** Whether the timeline has EVER run for this visitor (persisted) — the
   *  play button wears a first-visit nudge until it flips. */
  hasEverPlayed: boolean
  /** Full-timeline mode: widen range to cover all data (3700 BC – 2024 AD) */
  fullTimeline: boolean
}

interface TimelineActions {
  play: () => void
  pause: () => void
  setYear: (year: number) => void
  setSpeed: (speed: number) => void
  setScrubbing: (isScrubbing: boolean) => void
  toggleFullTimeline: () => void
}

export const ROMAN_MIN = -753
export const ROMAN_MAX = 1453
export const FULL_MIN = -3700
export const FULL_MAX = 2024

const PLAYED_KEY = 'atlas-played-v1'

const FULL_KEY = 'atlas-full-timeline-v1'

const initialState: TimelineState = {
  playing: false,
  currentYear: -753,
  speed: 1,
  isScrubbing: false,
  hasEverPlayed: typeof localStorage !== 'undefined' && localStorage.getItem(PLAYED_KEY) != null,
  fullTimeline: typeof localStorage !== 'undefined' && localStorage.getItem(FULL_KEY) != null,
}

export const useTimelineStore = create<TimelineState & TimelineActions>((set) => ({
  ...initialState,

  play: () => {
    try {
      localStorage.setItem(PLAYED_KEY, '1')
    } catch {
      /* private mode: nudge just repeats next visit */
    }
    set({ playing: true, hasEverPlayed: true })
  },
  pause: () => set({ playing: false }),
  setYear: (year) => set({ currentYear: year }),
  setSpeed: (speed) => set({ speed }),
  setScrubbing: (isScrubbing) => set({ isScrubbing }),
  toggleFullTimeline: () =>
    set((s) => {
      const next = !s.fullTimeline
      try {
        if (next) localStorage.setItem(FULL_KEY, '1')
        else localStorage.removeItem(FULL_KEY)
      } catch {
        /* private mode */
      }
      const min = next ? FULL_MIN : ROMAN_MIN
      const max = next ? FULL_MAX : ROMAN_MAX
      const year = Math.max(min, Math.min(max, s.currentYear))
      return { fullTimeline: next, currentYear: year }
    }),
}))

export function getInitialTimelineState(): TimelineState {
  return { ...initialState }
}
