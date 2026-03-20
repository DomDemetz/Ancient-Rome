import { Link, ChevronRight } from 'lucide-react'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { entityColors } from '@/lib/colors'
import { getConnectionCategory, connectionCategoryColors } from '@/lib/colors'
import { entities } from '@/data'
import type { Connection, Entity } from '@/types'

interface ConnectionListProps {
  entityId: string
  connections: Connection[]
}

function getConnectedEntity(entityId: string, conn: Connection): Entity | undefined {
  const otherId = conn.source === entityId ? conn.target : conn.source
  return entities.find((e) => e.id === otherId)
}

function formatConnectionType(type: string): string {
  return type.replace(/_/g, ' ')
}

export function ConnectionList({ entityId, connections }: ConnectionListProps) {
  const select = useSelectionStore((s) => s.select)

  const relevant = connections.filter((c) => c.source === entityId || c.target === entityId)

  if (relevant.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/50 flex items-center gap-1.5">
            <Link className="size-3.5" />
            Connections
          </span>
          <div className="flex-1 h-px bg-white/[0.05]" />
        </div>
        <p className="text-xs text-slate-500 italic">No connections found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/50 flex items-center gap-1.5">
          <Link className="size-3.5" />
          Connections ({relevant.length})
        </span>
        <div className="flex-1 h-px bg-white/[0.05]" />
      </div>
      <ul className="space-y-0.5">
        {relevant.map((conn) => {
          const other = getConnectedEntity(entityId, conn)
          const category = getConnectionCategory(conn.connectionType)
          const categoryColor = connectionCategoryColors[category]
          return (
            <li key={conn.id}>
              <button
                className={`w-full flex items-center gap-2 rounded-xl border border-transparent transition-all px-3 py-2.5 text-left group ${
                  other
                    ? 'hover:bg-white/[0.03] hover:border-white/[0.05] cursor-pointer'
                    : 'opacity-50 cursor-default'
                }`}
                onClick={() => other && select(other.id)}
                disabled={!other}
              >
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: categoryColor }}
                />
                <span className="flex-1 min-w-0">
                  <span className="text-sm text-slate-200 group-hover:text-amber-500 transition-colors truncate block">
                    {other ? (
                      <>
                        <span
                          className="size-1.5 rounded-full inline-block mr-1"
                          style={{
                            backgroundColor: other ? entityColors[other.entityType] : 'transparent',
                          }}
                        />
                        {other.name}
                      </>
                    ) : conn.source === entityId ? (
                      conn.target
                    ) : (
                      conn.source
                    )}
                  </span>
                  <span className="text-[10px] text-slate-500 capitalize">
                    {formatConnectionType(conn.connectionType)}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-slate-700 group-hover:text-amber-500 transition-colors" />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
