import { describe, it, expect, beforeEach } from 'vitest'
import { useSelectionStore, getInitialSelectionState } from './useSelectionStore'
import { useFilterStore, getInitialFilterState } from './useFilterStore'
import { useUIStore, getInitialUIState } from './useUIStore'
import { useTimelineStore, getInitialTimelineState } from './useTimelineStore'

// Reset stores before each test
beforeEach(() => {
  useSelectionStore.setState(getInitialSelectionState())
  useFilterStore.setState(getInitialFilterState())
  useUIStore.setState(getInitialUIState())
  useTimelineStore.setState(getInitialTimelineState())
})

// ── Selection Store ──────────────────────────────────────────────────────────

describe('useSelectionStore', () => {
  it('starts with null selectedId', () => {
    expect(useSelectionStore.getState().selectedId).toBeNull()
  })

  it('select() sets selectedId', () => {
    useSelectionStore.getState().select('entity-1')
    expect(useSelectionStore.getState().selectedId).toBe('entity-1')
  })

  it('select() appends to breadcrumbs', () => {
    useSelectionStore.getState().select('entity-1')
    useSelectionStore.getState().select('entity-2')
    expect(useSelectionStore.getState().breadcrumbs).toEqual(['entity-1', 'entity-2'])
  })

  it('select(null) does not add null to breadcrumbs', () => {
    useSelectionStore.getState().select('entity-1')
    useSelectionStore.getState().select(null)
    expect(useSelectionStore.getState().breadcrumbs).toEqual(['entity-1'])
    expect(useSelectionStore.getState().selectedId).toBeNull()
  })

  it('breadcrumbs are capped at 50', () => {
    for (let i = 0; i < 60; i++) {
      useSelectionStore.getState().select(`entity-${i}`)
    }
    expect(useSelectionStore.getState().breadcrumbs.length).toBe(50)
    // Should have the last 50 entries
    expect(useSelectionStore.getState().breadcrumbs[49]).toBe('entity-59')
  })

  it('hover() sets hoveredId', () => {
    useSelectionStore.getState().hover('entity-3')
    expect(useSelectionStore.getState().hoveredId).toBe('entity-3')
  })

  it('pin() adds to pinnedIds', () => {
    useSelectionStore.getState().pin('entity-1')
    expect(useSelectionStore.getState().pinnedIds).toContain('entity-1')
  })

  it('pin() does not duplicate', () => {
    useSelectionStore.getState().pin('entity-1')
    useSelectionStore.getState().pin('entity-1')
    expect(useSelectionStore.getState().pinnedIds.length).toBe(1)
  })

  it('unpin() removes from pinnedIds', () => {
    useSelectionStore.getState().pin('entity-1')
    useSelectionStore.getState().unpin('entity-1')
    expect(useSelectionStore.getState().pinnedIds).not.toContain('entity-1')
  })

  it('clearTrail() empties breadcrumbs', () => {
    useSelectionStore.getState().select('entity-1')
    useSelectionStore.getState().clearTrail()
    expect(useSelectionStore.getState().breadcrumbs).toEqual([])
  })
})

// ── Filter Store ─────────────────────────────────────────────────────────────

describe('useFilterStore', () => {
  it('starts with empty entityTypes', () => {
    expect(useFilterStore.getState().entityTypes).toEqual([])
  })

  it('starts with yearRange [-753, 476]', () => {
    expect(useFilterStore.getState().yearRange).toEqual([-753, 476])
  })

  it('setFilter() updates a field', () => {
    useFilterStore.getState().setFilter('searchQuery', 'Caesar')
    expect(useFilterStore.getState().searchQuery).toBe('Caesar')
  })

  it('setFilter() updates entityTypes array', () => {
    useFilterStore.getState().setFilter('entityTypes', ['person', 'event'])
    expect(useFilterStore.getState().entityTypes).toEqual(['person', 'event'])
  })

  it('setFilter() updates yearRange', () => {
    useFilterStore.getState().setFilter('yearRange', [-100, 100])
    expect(useFilterStore.getState().yearRange).toEqual([-100, 100])
  })

  it('resetFilters() resets to defaults', () => {
    useFilterStore.getState().setFilter('searchQuery', 'Caesar')
    useFilterStore.getState().setFilter('yearRange', [-100, 100])
    useFilterStore.getState().resetFilters()
    expect(useFilterStore.getState().searchQuery).toBe('')
    expect(useFilterStore.getState().yearRange).toEqual([-753, 476])
    expect(useFilterStore.getState().entityTypes).toEqual([])
  })

  it('saveSnapshot() captures current state', () => {
    useFilterStore.getState().setFilter('searchQuery', 'Augustus')
    useFilterStore.getState().saveSnapshot()
    const snapshot = useFilterStore.getState().snapshot
    expect(snapshot?.searchQuery).toBe('Augustus')
  })

  it('restoreSnapshot() restores saved state', () => {
    useFilterStore.getState().setFilter('searchQuery', 'Brutus')
    useFilterStore.getState().saveSnapshot()
    useFilterStore.getState().setFilter('searchQuery', 'Caesar')
    useFilterStore.getState().restoreSnapshot()
    expect(useFilterStore.getState().searchQuery).toBe('Brutus')
  })

  it('restoreSnapshot() does nothing if no snapshot', () => {
    useFilterStore.getState().setFilter('searchQuery', 'Caesar')
    useFilterStore.getState().restoreSnapshot() // snapshot is null
    expect(useFilterStore.getState().searchQuery).toBe('Caesar')
  })
})

// ── UI Store ──────────────────────────────────────────────────────────────────

describe('useUIStore', () => {
  it('toggleDetail() toggles detailPanelOpen', () => {
    expect(useUIStore.getState().detailPanelOpen).toBe(false)
    useUIStore.getState().toggleDetail()
    expect(useUIStore.getState().detailPanelOpen).toBe(true)
    useUIStore.getState().toggleDetail()
    expect(useUIStore.getState().detailPanelOpen).toBe(false)
  })

  it('toggleDetail(true) forces open', () => {
    useUIStore.getState().toggleDetail(true)
    expect(useUIStore.getState().detailPanelOpen).toBe(true)
  })

  it('setMobile() sets isMobile', () => {
    useUIStore.getState().setMobile(true)
    expect(useUIStore.getState().isMobile).toBe(true)
  })
})

// ── Timeline Store ───────────────────────────────────────────────────────────

describe('useTimelineStore', () => {
  it('starts not playing', () => {
    expect(useTimelineStore.getState().playing).toBe(false)
  })

  it('starts at year -753', () => {
    expect(useTimelineStore.getState().currentYear).toBe(-753)
  })

  it('starts at speed 1', () => {
    expect(useTimelineStore.getState().speed).toBe(1)
  })

  it('play() sets playing to true', () => {
    useTimelineStore.getState().play()
    expect(useTimelineStore.getState().playing).toBe(true)
  })

  it('pause() sets playing to false', () => {
    useTimelineStore.getState().play()
    useTimelineStore.getState().pause()
    expect(useTimelineStore.getState().playing).toBe(false)
  })

  it('setYear() updates currentYear', () => {
    useTimelineStore.getState().setYear(44)
    expect(useTimelineStore.getState().currentYear).toBe(44)
  })

  it('setYear() accepts negative years', () => {
    useTimelineStore.getState().setYear(-44)
    expect(useTimelineStore.getState().currentYear).toBe(-44)
  })

  it('setSpeed() updates speed', () => {
    useTimelineStore.getState().setSpeed(5)
    expect(useTimelineStore.getState().speed).toBe(5)
  })

  it('setScrubbing() updates isScrubbing', () => {
    useTimelineStore.getState().setScrubbing(true)
    expect(useTimelineStore.getState().isScrubbing).toBe(true)
  })
})
