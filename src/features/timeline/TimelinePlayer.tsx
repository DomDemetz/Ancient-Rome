import { useEffect, useMemo, useRef } from 'react'
import { Play, Pause } from 'lucide-react'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useUIStore } from '@/stores/useUIStore'
import { formatYear } from '@/lib/geo'

const MIN_YEAR = -753
const MAX_YEAR = 476
const YEARS_PER_SECOND = 50
const SPEEDS = [0.5, 1, 2, 4]

const TICK_MARKS = [
  { year: -753, label: 'Founding' },
  { year: -509, label: 'Republic' },
  { year: -264, label: 'Punic Wars' },
  { year: -27, label: 'Empire' },
  { year: 117, label: 'Peak' },
  { year: 284, label: 'Tetrarchy' },
  { year: 395, label: 'Split' },
  { year: 476, label: 'Fall' },
]

const ERAS = [
  { label: 'Kingdom', start: -753, end: -509 },
  { label: 'Republic', start: -509, end: -27 },
  { label: 'Early Empire', start: -27, end: 117 },
  { label: 'High Empire', start: 117, end: 235 },
  { label: 'Crisis', start: 235, end: 284 },
  { label: 'Late Empire', start: 284, end: 476 },
]

const TOTAL_YEARS = MAX_YEAR - MIN_YEAR // 1229

function yearToPercent(year: number): number {
  return ((year - MIN_YEAR) / TOTAL_YEARS) * 100
}

export function TimelinePlayer() {
  const playing = useTimelineStore((s) => s.playing)
  const currentYear = useTimelineStore((s) => s.currentYear)
  const speed = useTimelineStore((s) => s.speed)
  const play = useTimelineStore((s) => s.play)
  const pause = useTimelineStore((s) => s.pause)
  const setYear = useTimelineStore((s) => s.setYear)
  const setSpeed = useTimelineStore((s) => s.setSpeed)
  const setScrubbing = useTimelineStore((s) => s.setScrubbing)
  const isMobile = useUIStore((s) => s.isMobile)

  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)
  const yearRef = useRef(currentYear)

  // Keep yearRef in sync with EXTERNAL year changes (scrubbing, reset). During
  // playback yearRef is a float accumulator that we floor for display; resyncing
  // on our own integer setYear would throw away the fractional part and stall
  // playback whenever the per-frame delta is < 1 year (low speed / high FPS).
  useEffect(() => {
    if (Math.floor(yearRef.current) !== currentYear) {
      yearRef.current = currentYear
    }
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

      // Accumulate as a float so sub-1-year per-frame deltas aren't lost to
      // Math.floor — otherwise playback stalls at low speeds / high frame rates.
      yearRef.current += elapsed * YEARS_PER_SECOND * speed

      if (yearRef.current >= MAX_YEAR) {
        setYear(MAX_YEAR)
        pause()
        return
      }

      setYear(Math.floor(yearRef.current))
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
      // Sync ref immediately so the first RAF tick reads the reset value
      // (the useEffect syncing yearRef won't fire until after this handler)
      yearRef.current = MIN_YEAR
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

  const handleCycleSpeed = () => {
    const currentIndex = SPEEDS.indexOf(speed)
    const nextIndex = (currentIndex + 1) % SPEEDS.length
    setSpeed(SPEEDS[nextIndex])
  }

  const currentEra = useMemo(
    () => ERAS.find((e) => currentYear >= e.start && currentYear < e.end) ?? ERAS[ERAS.length - 1],
    [currentYear],
  )

  // Mobile: ultra-compact single row
  if (isMobile) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 bg-[#0a0a0c]/95 backdrop-blur-2xl border-t border-white/[0.06]"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <button
          onClick={handleTogglePlay}
          className={`flex items-center justify-center w-10 h-10 min-w-[44px] min-h-[44px] rounded-full shrink-0 transition-all ${
            playing ? 'bg-amber-500/15 text-amber-400' : 'bg-white/[0.05] text-amber-500'
          }`}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-px" />}
        </button>

        <span className="text-slate-300 font-mono text-[11px] w-14 shrink-0 text-center tabular-nums">
          {formatYear(Math.round(currentYear))}
        </span>

        <input
          type="range"
          min={MIN_YEAR}
          max={MAX_YEAR}
          step={1}
          value={Math.round(currentYear)}
          onChange={handleSliderChange}
          onTouchStart={handleSliderMouseDown}
          onTouchEnd={handleSliderMouseUp}
          onTouchCancel={handleSliderMouseUp}
          className="flex-1 accent-amber-400"
          style={{ touchAction: 'none' }}
          aria-label="Timeline year"
        />

        <button
          onClick={handleCycleSpeed}
          className="text-[10px] font-bold text-amber-500 bg-amber-500/10 rounded-full px-2.5 py-1 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
        >
          {speed}x
        </button>
      </div>
    )
  }

  // Desktop: full player
  return (
    <div className="flex flex-col px-5 pt-2.5 pb-1.5 bg-[#0a0a0c]/80 backdrop-blur-xl border-t border-white/[0.06]">
      <div className="flex items-center gap-3">
        <button
          onClick={handleTogglePlay}
          className={`flex items-center justify-center w-9 h-9 rounded-full text-amber-500 shrink-0 transition-all ${
            playing
              ? 'bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15'
              : 'bg-white/[0.05] border border-white/[0.06] hover:bg-white/[0.08]'
          }`}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        <span className="text-slate-300 font-mono text-sm w-20 shrink-0 text-center tabular-nums tracking-wide">
          {formatYear(Math.round(currentYear))}
        </span>

        <div className="relative flex-1 flex flex-col justify-center">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 pointer-events-none">
            {TICK_MARKS.map((tick) => (
              <div
                key={tick.year}
                className="absolute -translate-x-1/2 group"
                style={{ left: `${yearToPercent(tick.year)}%` }}
              >
                <div className="w-px h-3 bg-slate-500/30 mx-auto" />
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] text-slate-600 pointer-events-none z-10">
                  {tick.label}
                </div>
              </div>
            ))}
          </div>

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
            onTouchCancel={handleSliderMouseUp}
            className="w-full accent-amber-400"
            aria-label="Timeline year"
          />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-colors ${
                speed === s
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-transparent text-slate-500 border-white/[0.08] hover:text-white active:text-white'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center pb-0.5">
        <span
          key={currentEra.label}
          className="text-xs text-amber-500/60 font-mono tracking-wide transition-colors duration-300"
        >
          {currentEra.label} ({formatYear(currentEra.start)} →{' '}
          {formatYear(currentEra.end === 476 ? 476 : currentEra.end - 1)})
        </span>
      </div>
    </div>
  )
}
