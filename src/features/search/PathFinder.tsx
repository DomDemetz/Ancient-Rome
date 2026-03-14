import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { entities, connections } from '@/data'
import { findShortestPath } from '@/lib/pathfinding'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { entityColors } from '@/lib/colors'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import type { PathStep } from '@/lib/pathfinding'

function findEntityByName(name: string) {
  const lower = name.trim().toLowerCase()
  return entities.find((e) => e.name.toLowerCase() === lower) ?? null
}

export function PathFinder() {
  const [startName, setStartName] = useState('')
  const [endName, setEndName] = useState('')
  const [path, setPath] = useState<PathStep[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const select = useSelectionStore((s) => s.select)

  function handleFind() {
    setError(null)
    setPath(null)

    const startEntity = findEntityByName(startName)
    const endEntity = findEntityByName(endName)

    if (!startEntity) {
      setError(`Entity not found: "${startName}"`)
      return
    }
    if (!endEntity) {
      setError(`Entity not found: "${endName}"`)
      return
    }

    const result = findShortestPath(startEntity.id, endEntity.id, connections)

    if (!result) {
      setError('No path found between these entities.')
      return
    }

    setPath(result)
  }

  function getEntityName(id: string) {
    return entities.find((e) => e.id === id)?.name ?? id
  }

  function getEntityType(id: string) {
    return entities.find((e) => e.id === id)?.entityType ?? 'person'
  }

  return (
    <div className="p-4 space-y-3">
      <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Path Finder</p>

      <div className="space-y-2">
        <Input
          type="text"
          placeholder="Start entity name…"
          value={startName}
          onChange={(e) => setStartName(e.target.value)}
          className="h-7 text-xs bg-bg-card border-border text-text-primary placeholder:text-text-secondary"
        />
        <Input
          type="text"
          placeholder="End entity name…"
          value={endName}
          onChange={(e) => setEndName(e.target.value)}
          className="h-7 text-xs bg-bg-card border-border text-text-primary placeholder:text-text-secondary"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleFind()
          }}
        />
        <Button
          onClick={handleFind}
          size="sm"
          variant="outline"
          className="w-full text-xs border-border text-text-primary hover:bg-bg-secondary"
        >
          Find Path
        </Button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {path && (
        <ol className="space-y-1">
          {path.map((step, i) => {
            const name = getEntityName(step.entityId)
            const type = getEntityType(step.entityId)
            return (
              <li key={step.entityId} className="flex items-center gap-1.5">
                {i > 0 && <ArrowRight className="size-3 text-text-secondary shrink-0" />}
                <button
                  className="flex items-center gap-1.5 text-xs text-text-primary hover:text-accent-gold transition-colors"
                  onClick={() => select(step.entityId)}
                >
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: entityColors[type] }}
                  />
                  {name}
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
