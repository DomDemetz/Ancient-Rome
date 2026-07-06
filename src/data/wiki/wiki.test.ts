import { describe, it, expect } from 'vitest'
import { mergeStructuredData } from './index'
import type { WikiLookup, WikidataStructuredLookup, CrossRefLookup } from './index'

function makeWiki(overrides: Partial<WikiLookup[string]> = {}): WikiLookup[string] {
  return {
    wikiTitle: 'Test',
    resolvedVia: 'name-search',
    confidence: 1,
    extract: 'A modern city in Turkey.',
    romanEraExtract: 'A modern city in Turkey.',
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Test',
    fetchedAt: '2025-01-01',
    ...overrides,
  }
}

describe('mergeStructuredData — description cascade', () => {
  const emptyStructured: WikidataStructuredLookup = {}

  it('uses custom romanEraExtract when it differs from extract', () => {
    const wiki: WikiLookup = {
      '1': makeWiki({
        extract: 'Istanbul is a major city in Turkey.',
        romanEraExtract: 'Constantinople was founded by Emperor Constantine I in 330 AD.',
      }),
    }
    const result = mergeStructuredData(wiki, emptyStructured)
    expect(result['1'].description).toBe(
      'Constantinople was founded by Emperor Constantine I in 330 AD.',
    )
    expect(result['1'].descriptionSource).toBe('custom')
  })

  it('falls back to Pleiades description when no custom extract', () => {
    const wiki: WikiLookup = {
      '1': makeWiki({
        extract: 'A modern city.',
        romanEraExtract: 'A modern city.',
      }),
    }
    const crossRef: CrossRefLookup = {
      'settlement:1': {
        pleiadesDescription: 'An ancient Roman colony in Britannia.',
        sources: ['pleiades'],
      },
    }
    const result = mergeStructuredData(wiki, emptyStructured, crossRef, 'settlements')
    expect(result['1'].description).toBe('An ancient Roman colony in Britannia.')
    expect(result['1'].descriptionSource).toBe('pleiades')
  })

  it('falls back to generic extract when no custom and no Pleiades', () => {
    const wiki: WikiLookup = {
      '1': makeWiki({
        extract: 'A small town in Germany.',
        romanEraExtract: 'A small town in Germany.',
      }),
    }
    const result = mergeStructuredData(wiki, emptyStructured)
    expect(result['1'].description).toBe('A small town in Germany.')
    expect(result['1'].descriptionSource).toBe('generic')
  })

  it('prefers custom over Pleiades even when both exist', () => {
    const wiki: WikiLookup = {
      '1': makeWiki({
        extract: 'Modern description of the city.',
        romanEraExtract: 'Founded by Augustus in 25 BC as a veteran colony.',
      }),
    }
    const crossRef: CrossRefLookup = {
      'settlement:1': {
        pleiadesDescription: 'A Roman settlement.',
        sources: ['pleiades'],
      },
    }
    const result = mergeStructuredData(wiki, emptyStructured, crossRef, 'settlements')
    expect(result['1'].description).toBe('Founded by Augustus in 25 BC as a veteran colony.')
    expect(result['1'].descriptionSource).toBe('custom')
  })

  it('resolves cross-ref keys with layer prefix', () => {
    const wiki: WikiLookup = {
      colosseum: makeWiki({
        extract: 'A large amphitheater.',
        romanEraExtract: 'A large amphitheater.',
      }),
    }
    const crossRef: CrossRefLookup = {
      'amphitheater:colosseum': {
        pleiadesDescription: 'The Flavian Amphitheatre in Rome.',
        sources: ['pleiades'],
      },
    }
    const result = mergeStructuredData(wiki, emptyStructured, crossRef, 'amphitheaters')
    expect(result['colosseum'].description).toBe('The Flavian Amphitheatre in Rome.')
  })

  it('falls back to unprefixed cross-ref key', () => {
    const wiki: WikiLookup = {
      colosseum: makeWiki({
        extract: 'A large amphitheater.',
        romanEraExtract: 'A large amphitheater.',
      }),
    }
    const crossRef: CrossRefLookup = {
      colosseum: {
        pleiadesDescription: 'Flavian Amphitheatre.',
        sources: ['pleiades'],
      },
    }
    const result = mergeStructuredData(wiki, emptyStructured, crossRef, 'amphitheaters')
    expect(result['colosseum'].description).toBe('Flavian Amphitheatre.')
  })

  it('merges Wikidata structured data onto entries', () => {
    const wiki: WikiLookup = {
      '1': makeWiki(),
    }
    const structured: WikidataStructuredLookup = {
      '1': {
        wikidataId: 'Q12345',
        structured: { inceptionYear: -25, dimensions: { capacity: 50000 } },
        images: [{ url: 'https://example.com/img.jpg', caption: 'Test', license: 'CC BY' }],
        describedInSources: [],
        sourceQuality: 'academic',
        claims: [],
        fetchedAt: '2025-01-01',
      },
    }
    const result = mergeStructuredData(wiki, structured)
    expect(result['1'].structured?.dimensions?.capacity).toBe(50000)
    expect(result['1'].sourceQuality).toBe('academic')
    expect(result['1'].images).toHaveLength(1)
  })

  it('treats identical first-80-chars as non-custom (generic fallback)', () => {
    const shared = 'A'.repeat(80)
    const wiki: WikiLookup = {
      '1': makeWiki({
        extract: shared + ' — modern suffix',
        romanEraExtract: shared + ' — roman suffix',
      }),
    }
    const result = mergeStructuredData(wiki, emptyStructured)
    expect(result['1'].descriptionSource).toBe('generic')
  })
})
