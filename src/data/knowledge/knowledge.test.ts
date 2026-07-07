import { describe, expect, it } from 'vitest'
import { appendWikiTooltip } from '@/lib/wiki-popup'
import type { WikiLookup } from '@/data/wiki'
import placesRaw from './places.json?raw'
import fortsRaw from '../vici/fort.json?raw'
import settlementsRaw from '../vici/settlement.json?raw'
import mergedRaw from '../registry/vici-merged.json?raw'

// The consolidated graph-keyed knowledge store is the single lookup path
// for place popups (ENTITY-MODEL.md). These tests pin the chain the
// browser exercises: node id -> knowledge entry -> rendered popup.
const places = JSON.parse(placesRaw) as WikiLookup

describe('knowledge/places.json', () => {
  it('has Rome under its canonical node id, with extract and inline crossRef', () => {
    const rome = places['pl-423025']
    expect(rome).toBeDefined()
    expect(rome.extract).toMatch(/Rome/)
    expect(rome).toHaveProperty('crossRef')
    expect(rome).toHaveProperty('sources')
  })

  it('renders through appendWikiTooltip keyed by node id (popup chain)', () => {
    const html = appendWikiTooltip(
      '<div class="map-tooltip-title">Rome</div>',
      'pl-423025',
      places,
      'knowledge-places',
    )
    expect(html).toContain('map-tooltip-extract')
    expect(html).toContain('data-wiki-layer="knowledge-places"')
    expect(html).toContain('data-wiki-id="pl-423025"')
  })
})

describe('vici chunks', () => {
  it('fort chunk matches the ViciSiteRecord contract', () => {
    const forts = JSON.parse(fortsRaw) as Record<string, unknown>[]
    expect(forts.length).toBeGreaterThan(10000)
    for (const k of ['id', 'name', 'lat', 'lng', 'siteType', 'startYear', 'endYear']) {
      expect(forts[0]).toHaveProperty(k)
    }
  })

  it('contains no node-merged settlement points (the node draws the city)', () => {
    const merged = new Set(JSON.parse(mergedRaw) as string[])
    const settlements = JSON.parse(settlementsRaw) as { id: string }[]
    expect(settlements.filter((s) => merged.has(s.id))).toHaveLength(0)
  })
})

describe('unified-nodes join (UI adoption chain)', () => {
  it('the Flavian Amphitheatre resolves to Rome for the popup anchor line', async () => {
    const join = JSON.parse(
      (await import('../registry/unified-nodes.json?raw')).default,
    ) as Record<string, { node: string; name: string; km: number; rel: string }>
    const fl = join['amphitheater:flavian-amphitheater']
    expect(fl).toBeDefined()
    expect(fl.name).toBe('Rome')
    expect(fl.km).toBeLessThan(2)
  })
})
