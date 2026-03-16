import { X } from 'lucide-react'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { useUIStore } from '@/stores/useUIStore'
import { entities, connections } from '@/data'
import { ScrollArea } from '@/ui/scroll-area'
import { Button } from '@/ui/button'
import { Separator } from '@/ui/separator'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/ui/drawer'
import { EntityHeader } from './EntityHeader'
import { EgoRadar } from './EgoRadar'
import { ConnectionList } from './ConnectionList'
import { SourceLinks } from './SourceLinks'

function DetailPanelContent({ entityId }: { entityId: string }) {
  const select = useSelectionStore((s) => s.select)
  const entity = entities.find((e) => e.id === entityId)

  if (!entity) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-text-secondary text-sm">Entity not found.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 pb-3 border-b border-border shrink-0">
        <span className="text-xs text-text-secondary">Detail</span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => select(null)}
          className="text-text-secondary hover:text-text-primary"
          aria-label="Close detail panel"
        >
          <X className="size-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-5 space-y-5">
          <EntityHeader entity={entity} />

          <Separator />

          <EgoRadar entityId={entity.id} connections={connections} />

          <Separator />

          <ConnectionList entityId={entity.id} connections={connections} />

          {entity.sources.length > 0 && (
            <>
              <Separator />
              <SourceLinks sources={entity.sources} />
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

export function DetailPanel() {
  const selectedId = useSelectionStore((s) => s.selectedId)
  const select = useSelectionStore((s) => s.select)
  const isMobile = useUIStore((s) => s.isMobile)

  if (!selectedId) return null

  if (isMobile) {
    return (
      <Drawer
        open={!!selectedId}
        onOpenChange={(open) => {
          if (!open) select(null)
        }}
      >
        <DrawerContent className="bg-bg-card border-border max-h-[80vh]">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Entity Detail</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-hidden">
            <DetailPanelContent entityId={selectedId} />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <aside className="w-[340px] shrink-0 border-l border-border bg-bg-secondary overflow-hidden flex flex-col">
      <DetailPanelContent entityId={selectedId} />
    </aside>
  )
}
