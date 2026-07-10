import { useEffect, useMemo, useState } from 'react'
import { Marker } from 'react-leaflet'
import L from 'leaflet'
import { useMapViewport } from '@/hooks/useMapViewport'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useMapLayerStore } from '@/stores/useMapLayerStore'
import { useWikiEnrichment } from '@/hooks/useWikiEnrichment'
import { useFeatureDetailStore } from '@/stores/useFeatureDetailStore'
import { labelProjector } from '../layers/labelCollision'
import { SITE_TYPE_TO_LAYER } from '../layers/siteTypeLayers'
import citiesSearchJson from '@/data/registry/cities-search.json'

// labeled cities are obstacles — a monument name through "Rome" is
// unreadable both ways (same rule the empire labels follow)
const CITY_OBSTACLES = citiesSearchJson as Array<{ lat: number; lng: number; s: number; e: number }>

/** Zoomed fully into Rome, nothing was named: at z10+ the ancient city was
 *  ~60 anonymous dots around one "Rome" label — Colosseum, Forum, Pantheon
 *  all unlabeled until clicked. This overlay names the FAMOUS sites (the
 *  ones carrying a wiki extract in knowledge/features) at detail zoom,
 *  independent of the marker layers: it only labels types whose layer is
 *  currently on, so every label describes a dot that exists.
 */

interface ManifestEntry {
  k: string // knowledge/detail key, e.g. "amphitheater:flavian-amphitheater"
  n: string
  t: string
  la: number
  lo: number
  s?: number
  e?: number
}

let _manifest: ManifestEntry[] | null = null
let _promise: Promise<ManifestEntry[]> | null = null
function loadManifest(): Promise<ManifestEntry[]> {
  if (_manifest) return Promise.resolve(_manifest)
  _promise ??= import('@/data/registry/entity-search.json').then((m) => {
    _manifest = m.default as ManifestEntry[]
    return _manifest
  })
  // a transient failure (dev-server restart, flaky network) must not be
  // cached as a forever-rejected promise — clear it so the next mount retries
  _promise.catch(() => {
    _promise = null
  })
  return _promise
}

const MAX_LABELS = 40

/** The ingest stamps period-placeholder startYears (amphitheaters -70/-100,
 *  ports/aqueducts/mines -300, temples/religious -500, tombs -600 — see the
 *  enrichment-pipeline note in the workbench). A dot can afford a maybe-date;
 *  a printed NAME cannot: "S. Agnese" and "Villa Maxentii" were labeling
 *  100 AD Rome. Entries carrying a sentinel year stay unlabeled until the
 *  pipeline ships real dates (genuinely-dated years like -493 pass). */
const PLACEHOLDER_YEARS = new Set([-70, -100, -300, -500, -600])

/** The building chunk's placeholder startYear is -30 — indistinguishable
 *  from genuinely Augustan dates, so church names leak into the early
 *  empire ("S. Agnese" labeled 100 AD Rome). One rule history itself
 *  provides: no named Christian basilicas before Constantine. */
const CHURCH_NAME = /^(S\.|Ss\.|SS\.|San |Santa |Santi |Santissim|Sant'|Church|Basilica|Chiesa|Cappella)/i
const EDICT_OF_MILAN = 313

export function MonumentLabels() {
  const { zoom, bounds } = useMapViewport()
  const currentYear = useTimelineStore((s) => s.currentYear)
  const layerState = useMapLayerStore((s) => s) as unknown as Record<string, unknown>
  const datasetState = useMapLayerStore((s) => s.datasetState)
  const knowledge = useWikiEnrichment('knowledge-features')
  // the entity whose record is open is the user's declared intent — it must
  // win the declutter (searching Circus Maximus landed on it UNLABELED
  // because richer Palatine neighbors claimed the space first)
  const focusedKey = useFeatureDetailStore((s) => s.featureId)
  const [manifest, setManifest] = useState<ManifestEntry[]>(_manifest ?? [])

  useEffect(() => {
    if (!_manifest) loadManifest().then(setManifest)
  }, [])

  const labeled = useMemo(() => {
    if (zoom < 10 || !knowledge || manifest.length === 0) return []
    const typeActive = (t: string): boolean => {
      const m = SITE_TYPE_TO_LAYER[t]
      if (!m) return false
      if (m.dataset) return !!datasetState[m.dataset]?.show
      if (m.show) return !!layerState[m.show]
      return false
    }
    const candidates = manifest.filter((e) => {
      if (!typeActive(e.t)) return false
      // undated entries stay unlabeled: a dot is a quiet maybe, a NAME is a
      // claim — the first cut printed "Cinecittà" and a carpet of churches
      // over 100 AD Rome because unknown startYears passed the filter
      if (e.s == null || e.s === 0 || e.s > currentYear) return false
      if (PLACEHOLDER_YEARS.has(e.s)) return false
      if (currentYear < EDICT_OF_MILAN && CHURCH_NAME.test(e.n)) return false
      // ancient names are short; long ones are modern descriptive titles —
      // 'The "Auditorium site" at the Auditorium Parco della Musica (Rome)'
      // spanned a whole phone screen
      if (e.n.length > 28) return false
      if (e.e != null && e.e !== 0 && e.e < currentYear) return false
      if (e.la < bounds.getSouth() || e.la > bounds.getNorth()) return false
      if (e.lo < bounds.getWest() || e.lo > bounds.getEast()) return false
      return !!knowledge[e.k]?.extract
    })
    // fame proxy: longer extracts are the better-documented sites; the
    // focused (open-panel) entity outranks everything
    candidates.sort(
      (a, b) =>
        Number(b.k === focusedKey) - Number(a.k === focusedKey) ||
        (knowledge[b.k]?.extract?.length ?? 0) - (knowledge[a.k]?.extract?.length ?? 0),
    )
    const { x: mercX, y: mercY } = labelProjector(zoom)
    const placed: Array<[number, number, number]> = []
    for (const c of CITY_OBSTACLES) {
      if (c.s <= currentYear && c.e >= currentYear) {
        placed.push([mercX(c.lng), mercY(c.lat), 46])
      }
    }
    const out: ManifestEntry[] = []
    for (const e of candidates) {
      if (out.length >= MAX_LABELS) break
      const x = mercX(e.lo)
      const y = mercY(e.la) + 9 // label sits below the dot
      const halfW = Math.max(24, e.n.length * 3.1)
      if (placed.some(([px, py, pw]) => Math.abs(px - x) < pw + halfW && Math.abs(py - y) < 14))
        continue
      placed.push([x, y, halfW])
      out.push(e)
    }
    return out
  }, [zoom, bounds, currentYear, knowledge, manifest, layerState, datasetState, focusedKey])

  return (
    <>
      {labeled.map((e) => (
        <Marker
          key={`mlabel-${e.k}`}
          position={[e.la, e.lo]}
          interactive={false}
          icon={L.divIcon({
            className: 'monument-label-wrap',
            // the searched/open-record entity wears the focus chip — among
            // thirty dots and eight quiet labels, the result must declare
            // itself ("it's still not very visible")
            html: `<div class="monument-label${e.k === focusedKey ? ' monument-label--focus' : ''}">${e.n.replace(/[<>&]/g, '')}</div>`,
            iconSize: [0, 0],
          })}
        />
      ))}
    </>
  )
}
