import { describe, it, expect } from 'vitest'
import { mergeStructuredData } from './index'
import type { WikiLookup, WikidataStructuredLookup, CrossRefLookup } from './index'
import { appendCrossRefTooltip } from '@/lib/wiki-popup'

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

describe('appendCrossRefTooltip — unenriched place popups', () => {
  const base = '<div class="map-tooltip-title">Mesua</div>'

  it('shows real Pleiades description as extract', () => {
    const html = appendCrossRefTooltip(base, {
      pleiadesDescription:
        'A Pre-Roman settlement located north of the Étang de Thau. It later became a Roman colony.',
      sources: ['pleiades', 'dare'],
    })
    expect(html).toContain('A Pre-Roman settlement located north of the Étang de Thau.')
    expect(html).toContain('map-tooltip-extract')
    expect(html).toContain('2 sources')
  })

  it('skips citation-only descriptions from extract, shows as fact', () => {
    const html = appendCrossRefTooltip(base, {
      pleiadesDescription: 'An ancient place, cited: BAtlas 15 B2 Mesua',
      sources: ['pleiades'],
    })
    expect(html).not.toContain('map-tooltip-extract')
    expect(html).toContain('BAtlas 15 B2 Mesua')
    expect(html).toContain('map-tooltip-fact')
  })

  it('shows province when available', () => {
    const html = appendCrossRefTooltip(base, {
      province: 'Narbonensis',
      sources: ['pleiades'],
    })
    expect(html).toContain('Province: Narbonensis')
  })

  it('shows source badge with correct pluralization', () => {
    const single = appendCrossRefTooltip(base, { sources: ['pleiades'] })
    expect(single).toContain('1 source')
    expect(single).not.toContain('1 sources')

    const multi = appendCrossRefTooltip(base, { sources: ['pleiades', 'dare', 'topostext'] })
    expect(multi).toContain('3 sources')
  })

  it('shows ancient authors when available', () => {
    const html = appendCrossRefTooltip(base, {
      ancientAuthors: ['Pliny', 'Strabo'],
      sources: ['pleiades', 'Pelagios'],
    })
    expect(html).toContain('Cited by: Pliny, Strabo')
  })

  it('shows trade role when not generic city', () => {
    const port = appendCrossRefTooltip(base, {
      tradeRole: 'port',
      sources: ['ORBIS'],
    })
    expect(port).toContain('Trade: port')

    const city = appendCrossRefTooltip(base, {
      tradeRole: 'city',
      sources: ['ORBIS'],
    })
    expect(city).not.toContain('Trade:')
  })

  it('shows thumbnail when imageUrl is present', () => {
    const html = appendCrossRefTooltip(base, {
      imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Example.jpg?width=400',
      sources: ['Pleiades'],
    })
    expect(html).toContain('map-tooltip-thumb')
    expect(html).toContain('Example.jpg')
  })

  it('renders Details button with crossref layer when links provided', () => {
    const html = appendCrossRefTooltip(
      base,
      { sources: ['DARE', 'Pleiades'] },
      { crKey: 'settlement:12345', pid: '423025' },
    )
    expect(html).toContain('data-wiki-layer="crossref"')
    expect(html).toContain('data-wiki-id="settlement:12345"')
    expect(html).toContain('Details')
    expect(html).toContain('pleiades.stoa.org/places/423025')
  })

  it('uses wikidataDescription when Pleiades desc is cite-only', () => {
    const html = appendCrossRefTooltip(base, {
      pleiadesDescription: 'An ancient place, cited: BAtlas 59 B2',
      wikidataDescription: 'ancient Greek city in Attica',
      sources: ['Pleiades'],
    })
    expect(html).toContain('ancient Greek city in Attica')
    expect(html).not.toContain('An ancient place, cited')
  })

  it('prefers Pleiades description over wikidataDescription when real', () => {
    const html = appendCrossRefTooltip(base, {
      pleiadesDescription: 'A major port city on the coast of Ionia.',
      wikidataDescription: 'ancient Greek city',
      sources: ['Pleiades'],
    })
    expect(html).toContain('A major port city')
    expect(html).not.toContain('ancient Greek city')
  })
})
