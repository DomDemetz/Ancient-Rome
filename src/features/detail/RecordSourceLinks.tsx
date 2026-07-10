import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'

/**
 * Linked provenance for the detail panel: resolves the entity's merged
 * source keys (atlas/sources.json, lazy on first panel open) and renders
 * one link per source RECORD — the vici.org page, the Pleiades place,
 * the DARE place, the Wikidata item. The atlas's receipts row: every dot
 * can show exactly where it came from.
 */

let _cache: Record<string, string[]> | null = null
let _promise: Promise<Record<string, string[]>> | null = null
function loadSources(): Promise<Record<string, string[]>> {
  if (_cache) return Promise.resolve(_cache)
  if (!_promise) {
    _promise = import('@/data/entities/atlas/sources.json?raw').then((m) => {
      _cache = JSON.parse(m.default) as Record<string, string[]>
      return _cache
    })
  }
  return _promise
}

function linkFor(key: string): { label: string; url: string } | null {
  const [prefix, ...rest] = key.split(':')
  const id = rest.join(':')
  if (prefix === 'vici') {
    return { label: 'vici.org', url: `https://vici.org/vici/${id.replace(/^vici-/, '')}/` }
  }
  if (prefix === 'pleiades' || (prefix === 'building' && /^\d+$/.test(id))) {
    return { label: 'Pleiades', url: `https://pleiades.stoa.org/places/${id}` }
  }
  if (prefix === 'dare') {
    return { label: 'DARE', url: `https://dare.ht.lu.se/places/${id}` }
  }
  if (prefix === 'place') {
    if (id.startsWith('dare-'))
      return { label: 'DARE', url: `https://dare.ht.lu.se/places/${id.slice(5)}` }
    if (id.startsWith('pl-'))
      return { label: 'Pleiades', url: `https://pleiades.stoa.org/places/${id.slice(3)}` }
    if (id.startsWith('wd-'))
      return { label: 'Wikidata', url: `https://www.wikidata.org/wiki/${id.slice(3)}` }
    return null
  }
  if (id.startsWith('wd-')) {
    const q = id.match(/Q\d+/)?.[0]
    if (q) return { label: 'Wikidata', url: `https://www.wikidata.org/wiki/${q}` }
  }
  if (prefix === 'port')
    return { label: 'Ancient Ports', url: 'https://www.ancientportsantiques.com/' }
  if (prefix === 'shipwreck' || prefix === 'mine')
    return { label: 'OxREP', url: 'https://oxrep.classics.ox.ac.uk/databases/' }
  if (prefix === 'amphitheater')
    return { label: 'Amphitheatre DB', url: 'https://romanamphitheaters.com/' }
  return null
}

export function RecordSourceLinks({
  lookupKeys,
  skipUrls,
}: {
  lookupKeys: string[]
  skipUrls?: string[]
}) {
  const [links, setLinks] = useState<Array<{ label: string; url: string }>>([])

  useEffect(() => {
    let live = true
    loadSources().then((idx) => {
      if (!live) return
      const keys = lookupKeys.map((k) => idx[k]).find((v) => v?.length) ?? []
      const out: Array<{ label: string; url: string }> = []
      const seen = new Set<string>(skipUrls ?? [])
      for (const key of keys) {
        const l = linkFor(key)
        if (l && !seen.has(l.url)) {
          seen.add(l.url)
          out.push(l)
        }
      }
      setLinks(out)
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(lookupKeys), JSON.stringify(skipUrls)])

  if (!links.length) return null
  return (
    <>
      {links.map((l) => (
        <a
          key={l.url}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300"
        >
          <ExternalLink className="size-3" /> {l.label}
        </a>
      ))}
    </>
  )
}
