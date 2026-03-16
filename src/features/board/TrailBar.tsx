import { History } from 'lucide-react'
import { Badge } from '@/ui/badge'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { useUIStore } from '@/stores/useUIStore'
import { entities } from '@/data'
import { entityColors } from '@/lib/colors'

const MAX_VISIBLE = 8

export function TrailBar() {
  const breadcrumbs = useSelectionStore((s) => s.breadcrumbs)
  const select = useSelectionStore((s) => s.select)
  const isMobile = useUIStore((s) => s.isMobile)

  if (breadcrumbs.length === 0) return null

  const visible = breadcrumbs.slice(-MAX_VISIBLE)

  return (
    <div className="flex items-center gap-1.5 border-t border-border px-4 py-2 shrink-0 overflow-x-auto">
      <History className="size-3.5 text-text-secondary shrink-0" />
      {visible.map((id, i) => {
        const entity = entities.find((e) => e.id === id)
        const color = entity ? entityColors[entity.entityType] : undefined
        return (
          <Badge
            key={`${id}-${breadcrumbs.length - MAX_VISIBLE + i}`}
            variant="outline"
            className={`cursor-pointer hover:bg-muted rounded-full inline-flex items-center gap-1.5 ${isMobile ? 'min-h-[44px]' : ''}`}
            onClick={() => select(id)}
          >
            {color && (
              <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
            )}
            {entity ? entity.name : id}
          </Badge>
        )
      })}
    </div>
  )
}
