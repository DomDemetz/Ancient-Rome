import { useState, useRef, useEffect, useMemo } from 'react'
import Fuse from 'fuse.js'
import { Search } from 'lucide-react'
import { entities } from '@/data'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { useFilterStore } from '@/stores/useFilterStore'
import { entityColors, entityLabels } from '@/lib/colors'
import { Input } from '@/ui/input'
import type { Entity } from '@/types'

const MAX_RESULTS = 8

export function SearchBar() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const select = useSelectionStore((s) => s.select)
  const setFilter = useFilterStore((s) => s.setFilter)

  const fuse = useMemo(
    () =>
      new Fuse(entities, {
        keys: ['name', 'description'],
        threshold: 0.4,
      }),
    [],
  )

  const results: Entity[] = useMemo(() => {
    if (!query.trim()) return []
    return fuse.search(query, { limit: MAX_RESULTS }).map((r) => r.item)
  }, [fuse, query])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(entity: Entity) {
    select(entity.id)
    setFilter('searchQuery', entity.name)
    setQuery(entity.name)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative w-56">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-text-secondary pointer-events-none" />
        <Input
          type="text"
          placeholder="Search entities…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          className="pl-7 h-7 text-xs bg-bg-card border-border text-text-primary placeholder:text-text-secondary"
        />
      </div>

      {open && results.length > 0 && (
        <ul className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-border bg-bg-card shadow-lg overflow-hidden">
          {results.map((entity) => (
            <li key={entity.id}>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-bg-secondary transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelect(entity)
                }}
              >
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: entityColors[entity.entityType] }}
                />
                <span className="text-text-secondary shrink-0">
                  {entityLabels[entity.entityType]}
                </span>
                <span className="text-text-primary truncate">{entity.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
