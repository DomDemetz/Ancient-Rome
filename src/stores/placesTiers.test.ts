import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import type { PlaceNode } from '@/data/places'

// The zoom-7 tiers (places detail 5.8 MB, minor-node knowledge 4.3 MB) must
// not download with the default view: only on requestPlacesDetail /
// requestKnowledgePlacesMinor (PlacesLayer at zoom 7, the search box).

const node = (id: string): PlaceNode => ({ id, name: id, lat: 0, lng: 0, startYear: 0, endYear: 0 })

const places = vi.hoisted(() => ({
  loadPlacesCore: vi.fn(),
  loadPlacesDetail: vi.fn(),
}))
vi.mock('@/data/places', () => places)

const wiki = vi.hoisted(() => ({
  loadKnowledgePlacesCore: vi.fn(),
  loadKnowledgePlacesMinor: vi.fn(),
}))
vi.mock('@/data/wiki', () => wiki)

// module-level tier state (in-flight promises) is per import: fresh per test
async function freshStore() {
  vi.resetModules()
  return import('./useMapLayerStore')
}

beforeEach(() => {
  vi.clearAllMocks()
  places.loadPlacesCore.mockResolvedValue([node('core-1'), node('shared')])
  places.loadPlacesDetail.mockResolvedValue([node('shared'), node('minor-1')])
  wiki.loadKnowledgePlacesCore.mockResolvedValue({ 'core-1': { extract: 'core' } })
  wiki.loadKnowledgePlacesMinor.mockResolvedValue({ 'minor-1': { extract: 'minor' } })
})

describe('places detail tier', () => {
  it('turning Settlements on loads the core tier only', async () => {
    const { useMapLayerStore } = await freshStore()
    await useMapLayerStore.getState().toggleSettlements()
    await new Promise((r) => setTimeout(r, 0))
    expect(places.loadPlacesCore).toHaveBeenCalledTimes(1)
    expect(places.loadPlacesDetail).not.toHaveBeenCalled()
    expect(useMapLayerStore.getState().placesData?.map((p) => p.id)).toEqual(['core-1', 'shared'])
    expect(useMapLayerStore.getState().placesDetailLoaded).toBe(false)
  })

  it('the economy preset (default view) loads the core tier only', async () => {
    const { useMapLayerStore } = await freshStore()
    useMapLayerStore.getState().activatePreset('economy')
    await waitFor(() => expect(useMapLayerStore.getState().placesData).not.toBeNull())
    expect(places.loadPlacesDetail).not.toHaveBeenCalled()
  })

  it('a request before the core tier is in is a no-op', async () => {
    const { requestPlacesDetail } = await freshStore()
    await requestPlacesDetail()
    expect(places.loadPlacesDetail).not.toHaveBeenCalled()
  })

  it('requestPlacesDetail merges the detail tier once, deduped by id', async () => {
    const { useMapLayerStore, requestPlacesDetail } = await freshStore()
    await useMapLayerStore.getState().toggleSettlements()
    await Promise.all([requestPlacesDetail(), requestPlacesDetail()])
    await requestPlacesDetail()
    expect(places.loadPlacesDetail).toHaveBeenCalledTimes(1)
    expect(useMapLayerStore.getState().placesData?.map((p) => p.id)).toEqual([
      'core-1',
      'shared',
      'minor-1',
    ])
    expect(useMapLayerStore.getState().placesDetailLoaded).toBe(true)
  })

  it('a failed detail fetch can be retried', async () => {
    const { useMapLayerStore, requestPlacesDetail } = await freshStore()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    places.loadPlacesDetail.mockRejectedValueOnce(new Error('offline'))
    await useMapLayerStore.getState().toggleSettlements()
    await requestPlacesDetail()
    expect(useMapLayerStore.getState().placesDetailLoaded).toBe(false)
    await requestPlacesDetail()
    expect(places.loadPlacesDetail).toHaveBeenCalledTimes(2)
    expect(useMapLayerStore.getState().placesDetailLoaded).toBe(true)
  })
})

describe('minor-node knowledge tier', () => {
  async function freshHook() {
    vi.resetModules()
    return import('@/hooks/useWikiEnrichment')
  }

  it('knowledge-places loads the core tier only', async () => {
    const { useWikiEnrichment } = await freshHook()
    const { result } = renderHook(() => useWikiEnrichment('knowledge-places'))
    await waitFor(() => expect(result.current).not.toBeNull())
    expect(Object.keys(result.current!)).toEqual(['core-1'])
    expect(wiki.loadKnowledgePlacesMinor).not.toHaveBeenCalled()
  })

  it('a request after core merges minor into the same entry', async () => {
    const { useWikiEnrichment, requestKnowledgePlacesMinor } = await freshHook()
    const { result } = renderHook(() => useWikiEnrichment('knowledge-places'))
    await waitFor(() => expect(result.current).not.toBeNull())
    act(() => requestKnowledgePlacesMinor())
    requestKnowledgePlacesMinor()
    await waitFor(() => expect(result.current?.['minor-1']).toBeDefined())
    expect(result.current?.['core-1']).toBeDefined()
    expect(wiki.loadKnowledgePlacesMinor).toHaveBeenCalledTimes(1)
  })

  it('minor landing before core is not lost', async () => {
    const { useWikiEnrichment, requestKnowledgePlacesMinor } = await freshHook()
    requestKnowledgePlacesMinor()
    await waitFor(() => expect(wiki.loadKnowledgePlacesMinor).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 0))
    const { result } = renderHook(() => useWikiEnrichment('knowledge-places'))
    await waitFor(() => expect(result.current).not.toBeNull())
    expect(Object.keys(result.current!).sort()).toEqual(['core-1', 'minor-1'])
  })
})
