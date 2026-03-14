import { create } from 'zustand'

interface TimelineState {
  playing: boolean
  currentYear: number
  speed: number
  isScrubbing: boolean
}

interface TimelineActions {
  play: () => void
  pause: () => void
  setYear: (year: number) => void
  setSpeed: (speed: number) => void
  setScrubbing: (isScrubbing: boolean) => void
}

const initialState: TimelineState = {
  playing: false,
  currentYear: -753,
  speed: 1,
  isScrubbing: false,
}

export const useTimelineStore = create<TimelineState & TimelineActions>((set) => ({
  ...initialState,

  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  setYear: (year) => set({ currentYear: year }),
  setSpeed: (speed) => set({ speed }),
  setScrubbing: (isScrubbing) => set({ isScrubbing }),
}))

export function getInitialTimelineState(): TimelineState {
  return { ...initialState }
}
