import { useEffect, useRef } from 'react'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { formatYear } from '@/lib/geo'

const MIN_YEAR = -753
const MAX_YEAR = 476
const YEARS_PER_SECOND = 50
const SPEEDS = [0.5, 1, 2, 4]

export function TimelinePlayer() {
  const playing = useTimelineStore((s) => s.playing)
  const currentYear = useTimelineStore((s) => s.currentYear)
  const speed = useTimelineStore((s) => s.speed)
  const play = useTimelineStore((s) => s.play)
  const pause = useTimelineStore((s) => s.pause)
  const setYear = useTimelineStore((s) => s.setYear)
  const setSpeed = useTimelineStore((s) => s.setSpeed)
  const setScrubbing = useTimelineStore((s) => s.setScrubbing)

  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)
  const yearRef = useRef(currentYear)

  // Keep yearRef in sync so the RAF callback always has the latest year
  useEffect(() => {
    yearRef.current = currentYear
  }, [currentYear])

  useEffect(() => {
    if (!playing) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      lastTimeRef.current = null
      return
    }

    const tick = (timestamp: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp
      }
      const elapsed = (timestamp - lastTimeRef.current) / 1000 // seconds
      lastTimeRef.current = timestamp

      const delta = elapsed * YEARS_PER_SECOND * speed
      const nextYear = yearRef.current + delta

      if (nextYear >= MAX_YEAR) {
        setYear(MAX_YEAR)
        pause()
        return
      }

      setYear(Math.floor(nextYear))
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [playing, speed, pause, setYear])

  const handleTogglePlay = () => {
    if (currentYear >= MAX_YEAR) {
      setYear(MIN_YEAR)
    }
    if (playing) {
      pause()
    } else {
      play()
    }
  }

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setYear(Number(e.target.value))
  }

  const handleSliderMouseDown = () => setScrubbing(true)
  const handleSliderMouseUp = () => setScrubbing(false)

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-bg-secondary border-t border-border">
      {/* Play / Pause */}
      <button
        onClick={handleTogglePlay}
        className="w-8 h-8 flex items-center justify-center rounded bg-bg-primary hover:bg-bg-hover text-text-primary border border-border shrink-0"
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? (
          // Pause icon
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <rect x="2" y="1" width="4" height="12" rx="1" />
            <rect x="8" y="1" width="4" height="12" rx="1" />
          </svg>
        ) : (
          // Play icon
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <polygon points="2,1 12,7 2,13" />
          </svg>
        )}
      </button>

      {/* Year display */}
      <span className="text-text-primary text-sm font-mono w-16 shrink-0 text-center">
        {formatYear(Math.round(currentYear))}
      </span>

      {/* Range slider */}
      <input
        type="range"
        min={MIN_YEAR}
        max={MAX_YEAR}
        step={1}
        value={Math.round(currentYear)}
        onChange={handleSliderChange}
        onMouseDown={handleSliderMouseDown}
        onMouseUp={handleSliderMouseUp}
        onTouchStart={handleSliderMouseDown}
        onTouchEnd={handleSliderMouseUp}
        className="flex-1 accent-amber-400"
        aria-label="Timeline year"
      />

      {/* Speed selector */}
      <div className="flex items-center gap-1 shrink-0">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={`text-xs px-1.5 py-0.5 rounded border ${
              speed === s
                ? 'bg-amber-400 text-black border-amber-400'
                : 'bg-bg-primary text-text-secondary border-border hover:text-text-primary'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  )
}
