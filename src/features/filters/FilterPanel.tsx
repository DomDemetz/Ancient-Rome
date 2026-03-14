import { RotateCcw } from 'lucide-react'
import { useFilterStore } from '@/stores/useFilterStore'
import { EntityTypeFilter } from './EntityTypeFilter'
import { ConnectionTypeFilter } from './ConnectionTypeFilter'
import { TimePeriodFilter } from './TimePeriodFilter'
import { Button } from '@/ui/button'

export function FilterPanel() {
  const resetFilters = useFilterStore((s) => s.resetFilters)

  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-text-primary">Filters</p>
        <Button
          variant="ghost"
          size="xs"
          onClick={resetFilters}
          className="text-text-secondary hover:text-text-primary gap-1"
        >
          <RotateCcw className="size-3" />
          Reset
        </Button>
      </div>

      <EntityTypeFilter />

      <div className="border-t border-border" />

      <ConnectionTypeFilter />

      <div className="border-t border-border" />

      <TimePeriodFilter />
    </div>
  )
}
