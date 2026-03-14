import { Badge } from '@/ui/badge'
import { useSelectionStore } from '@/stores/useSelectionStore'

const MAX_VISIBLE = 8

export function TrailBar() {
  const breadcrumbs = useSelectionStore((s) => s.breadcrumbs)
  const select = useSelectionStore((s) => s.select)

  if (breadcrumbs.length === 0) return null

  const visible = breadcrumbs.slice(-MAX_VISIBLE)

  return (
    <div className="flex items-center gap-1.5 border-t border-border px-4 py-2 shrink-0 overflow-x-auto">
      {visible.map((id, i) => (
        <Badge
          key={`${id}-${i}`}
          variant="outline"
          className="cursor-pointer hover:bg-muted"
          onClick={() => select(id)}
        >
          {id}
        </Badge>
      ))}
    </div>
  )
}
