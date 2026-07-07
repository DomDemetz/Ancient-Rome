import { create } from 'zustand'

interface TimelineState {
  playing: boolean
  currentYear: number
  speed: number
  isScrubbing: boolean
  /** Whether the timeline has EVER run for this visitor (persisted) — the
   *  play button wears a first-visit nudge until it flips. */
  hasEverPlayed: boolean
}

interface TimelineActions {
  play: () => void
  pause: () => void
  setYear: (year: number) => void
  setSpeed: (speed: number) => void
  setScrubbing: (isScrubbing: boolean) => void
}

const PLAYED_KEY = 'atlas-played-v1'

const initialState: TimelineState = {
  playing: false,
  currentYear: -753,
  speed: 1,
  isScrubbing: false,
  hasEverPlayed: typeof localStorage !== 'undefined' && localStorage.getItem(PLAYED_KEY) != null,
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
}))

export function getInitialTimelineState(): TimelineState {
  return { ...initialState }
}
