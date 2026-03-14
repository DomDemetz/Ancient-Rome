import { useFilterStore } from '@/stores/useFilterStore'
import { formatYear } from '@/lib/geo'

const MIN_YEAR = -753
const MAX_YEAR = 476

export function TimePeriodFilter() {
  const yearRange = useFilterStore((s) => s.yearRange)
  const setFilter = useFilterStore((s) => s.setFilter)

  function handleStart(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseInt(e.target.value, 10)
    if (!isNaN(val)) {
      setFilter('yearRange', [Math.min(val, yearRange[1]), yearRange[1]])
    }
  }

  function handleEnd(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseInt(e.target.value, 10)
    if (!isNaN(val)) {
      setFilter('yearRange', [yearRange[0], Math.max(val, yearRange[0])])
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Time Period</p>
      <div className="space-y-2">
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-text-secondary">
            <span>From</span>
            <span className="text-text-primary font-medium">{formatYear(yearRange[0])}</span>
          </div>
          <input
            type="range"
            min={MIN_YEAR}
            max={MAX_YEAR}
            value={yearRange[0]}
            onChange={handleStart}
            className="w-full h-1.5 appearance-none rounded-full bg-border accent-accent-gold cursor-pointer"
          />
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-text-secondary">
            <span>To</span>
            <span className="text-text-primary font-medium">{formatYear(yearRange[1])}</span>
          </div>
          <input
            type="range"
            min={MIN_YEAR}
            max={MAX_YEAR}
            value={yearRange[1]}
            onChange={handleEnd}
            className="w-full h-1.5 appearance-none rounded-full bg-border accent-accent-gold cursor-pointer"
          />
        </div>
      </div>
      <div className="flex justify-between text-xs text-text-secondary">
        <span>{formatYear(MIN_YEAR)}</span>
        <span>{formatYear(MAX_YEAR)}</span>
      </div>
    </div>
  )
}
