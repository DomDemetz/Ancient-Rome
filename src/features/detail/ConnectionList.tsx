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
        <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">
          Connections
        </p>
        <p className="text-xs text-text-secondary italic">No connections found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">
        Connections ({relevant.length})
      </p>
      <ul className="space-y-1">
        {relevant.map((conn) => {
          const other = getConnectedEntity(entityId, conn)
          const category = getConnectionCategory(conn.connectionType)
          const categoryColor = connectionCategoryColors[category]
          return (
            <li key={conn.id}>
              <button
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-bg-secondary transition-colors group"
                onClick={() => other && select(other.id)}
              >
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: categoryColor }}
                />
                <span className="flex-1 min-w-0">
                  <span className="text-xs text-text-primary group-hover:text-accent-gold transition-colors truncate block">
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
                  <span className="text-xs text-text-secondary capitalize">
                    {formatConnectionType(conn.connectionType)}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
