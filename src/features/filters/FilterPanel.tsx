import { RotateCcw, Filter } from 'lucide-react'
import { useFilterStore } from '@/stores/useFilterStore'
import { EntityTypeFilter } from './EntityTypeFilter'
import { ConnectionTypeFilter } from './ConnectionTypeFilter'
import { TimePeriodFilter } from './TimePeriodFilter'
import { Button } from '@/ui/button'
import { Separator } from '@/ui/separator'

export function FilterPanel() {
  const resetFilters = useFilterStore((s) => s.resetFilters)

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
          <Filter className="size-4 text-amber-500/70" />
          <span className="text-amber-500/70">Filters</span>
        </p>
        <Button
          variant="ghost"
          size="xs"
          onClick={resetFilters}
          className="text-slate-400 hover:text-slate-100 gap-1"
        >
          <RotateCcw className="size-3" />
          Reset
        </Button>
      </div>

      <EntityTypeFilter />

      <Separator className="bg-white/[0.05]" />

      <ConnectionTypeFilter />

      <Separator className="bg-white/[0.05]" />

      <TimePeriodFilter />
    </div>
  )
}
