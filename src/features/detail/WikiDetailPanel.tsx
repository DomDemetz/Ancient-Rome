import { useEffect, useState } from 'react'
import { Shield, AlertTriangle } from 'lucide-react'
import { useFeatureDetailStore } from '@/stores/useFeatureDetailStore'
import { RecordSourceLinks } from './RecordSourceLinks'
import { useUIStore } from '@/stores/useUIStore'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/ui/drawer'
import { useWikiEnrichment, useCrossRef, isCrossRefLoading } from '@/hooks/useWikiEnrichment'
import { formatYear } from '@/lib/geo'
import { DetailShell, DetailLink, type DetailFact } from './DetailShell'

// Every variant below is a thin content-mapper feeding DetailShell slots —
// ONE display contract for the whole panel (see DetailShell's docstring).

// --- Header badges (slot 1 content) ---

function SourceBadge({ quality }: { quality?: 'academic' | 'sourced' | 'unsourced' }) {
  if (!quality) return null
  const config = {
    academic: {
      label: 'Academic',
      className: 'text-amber-300/90 bg-amber-400/10 border-amber-400/25',
    },
    sourced: { label: 'Sourced', className: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
    unsourced: {
      label: 'Community',
      className: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
    },
  }[quality]

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider border rounded ${config.className}`}
    >
      <Shield className="size-2.5" />
      {config.label}
    </span>
  )
}

function SourcesCountBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider border rounded text-amber-300/90 bg-amber-400/10 border-amber-400/25">
      <Shield className="size-2.5" />
      {count} source{count > 1 ? 's' : ''}
    </span>
  )
}

// --- Fact hygiene guards ---

// Wikidata quantities were extracted without their units (SPARQL label
// service returns the bare amount), so the stored numbers mix m²/ha/km².
// Only display values that carry a unit in the string.
const hasUnit = (v: string) => /[a-z²]/i.test(v)

// A Wikidata date far outside the atlas timeline means the QID points at a
// modern entity (film studio, nature reserve, reconstruction) — hide it
// rather than show an anachronism as fact.
const inAtlasWindow = (y: number) => y >= -10000 && y <= 1500

// --- Cross-ref detail (lightweight panel for 94% of nodes without wiki) ---

function CrossRefDetailContent({
  cr,
  crKey,
  entityId,
  onClose,
}: {
  cr: import('@/data/wiki').CrossRefEnrichment
  crKey: string
  entityId?: string | null
  onClose: () => void
}) {
  const isDiscovery = crKey.startsWith('discovery-')
  const bareId = crKey.includes(':') ? crKey.split(':')[1] : null
  const hasPleiadesSrc = cr.sources?.includes('Pleiades')
  const pid = crKey.startsWith('pleiades:')
    ? bareId
    : isDiscovery
      ? bareId
      : hasPleiadesSrc && bareId && /^\d+$/.test(bareId)
        ? bareId
        : null
  const dareId = crKey.startsWith('settlement:') ? crKey.replace('settlement:', '') : null

  const isSettlement = crKey.startsWith('settlement:') || crKey.startsWith('pleiades:')
  const primarySrc = isSettlement ? 'DARE' : cr.sources?.[0]

  const facts: DetailFact[] = []
  if (cr.ancientName && cr.ancientName !== 'Untitled') {
    const nameLabel = isSettlement ? 'Ancient name' : 'Name'
    facts.push({ label: nameLabel, value: cr.ancientName, source: primarySrc })
  }
  if (cr.greekName) facts.push({ label: 'Greek', value: cr.greekName, source: primarySrc })
  if (cr.modernName) facts.push({ label: 'Modern', value: cr.modernName, source: primarySrc })
  if (cr.province)
    facts.push({ label: 'Province', value: cr.province, source: cr.provinceSrc ?? 'ORBIS' })
  // DARE sentinel: startYear 0 means unknown, not 1 BC
  if (cr.startYear != null && cr.startYear !== 0) {
    // Pleiades/DARE years are attestation ranges (when the place is known to
    // have existed), NOT construction/founding dates — label them honestly
    const yearLabel = crKey.startsWith('battle:') ? 'Date' : 'Attested'
    facts.push({ label: yearLabel, value: formatYear(cr.startYear), source: primarySrc })
  }
  if (cr.endYear != null && cr.endYear !== 0 && cr.endYear < 700)
    facts.push({ label: 'Until', value: formatYear(cr.endYear), source: primarySrc })
  if (cr.tradeRole && cr.tradeRole !== 'city')
    facts.push({ label: 'Trade role', value: cr.tradeRole, source: 'ORBIS' })
  if (cr.buildingType) facts.push({ label: 'Type', value: cr.buildingType, source: 'Pleiades' })
  if (cr.capacity) facts.push({ label: 'Capacity', value: cr.capacity.toLocaleString() })
  if (cr.dimensions) facts.push({ label: 'Dimensions', value: cr.dimensions })
  if (cr.combatants) facts.push({ label: 'Combatants', value: cr.combatants })
  if (cr.commander) facts.push({ label: 'Commander', value: cr.commander })
  if (cr.outcome) facts.push({ label: 'Outcome', value: cr.outcome })
  if (cr.ancientTextMentions)
    facts.push({
      label: 'Text mentions',
      value: cr.ancientTextMentions.toLocaleString(),
      source: 'Pelagios',
    })
  if (cr.ancientAuthors?.length)
    facts.push({
      label: 'Ancient authors',
      value: cr.ancientAuthors.join(', '),
      source: 'Pelagios',
    })

  const wd = cr.wdProps
  if (wd) {
    if (wd.inception && inAtlasWindow(wd.inception))
      facts.push({ label: 'Founded', value: formatYear(wd.inception), source: 'Wikidata' })
    if (wd.dissolved && inAtlasWindow(wd.dissolved))
      facts.push({ label: 'Abandoned', value: formatYear(wd.dissolved), source: 'Wikidata' })
    if (wd.architect) facts.push({ label: 'Architect', value: wd.architect, source: 'Wikidata' })
    if (wd.commissionedBy)
      facts.push({ label: 'Commissioned by', value: wd.commissionedBy, source: 'Wikidata' })
    if (wd.height && hasUnit(wd.height)) facts.push({ label: 'Height', value: wd.height })
    if (wd.width && hasUnit(wd.width)) facts.push({ label: 'Width', value: wd.width })
    if (wd.length && hasUnit(wd.length)) facts.push({ label: 'Length', value: wd.length })
    if (wd.area && hasUnit(wd.area) && !facts.some((f) => f.label === 'Area'))
      facts.push({ label: 'Area', value: wd.area })
    const mat = wd.materials?.join(', ') ?? wd.material
    if (mat) facts.push({ label: 'Material', value: mat, source: 'Wikidata' })
    if (wd.architecturalStyle)
      facts.push({ label: 'Style', value: wd.architecturalStyle, source: 'Wikidata' })
    const heritage = wd.heritageStatuses?.join(', ') ?? wd.heritageStatus
    if (heritage) facts.push({ label: 'Heritage', value: heritage, source: 'Wikidata' })
    if (wd.namedAfter)
      facts.push({ label: 'Named after', value: wd.namedAfter, source: 'Wikidata' })
  }

  // slot 4 — description paragraph
  const body = (() => {
    if (cr.containedInQid) {
      const cityName = cr.wikiUrl
        ? decodeURIComponent(cr.wikiUrl.split('/wiki/').pop() ?? '').replace(/_/g, ' ')
        : null
      if (!cityName) return null
      return (
        <p className="text-sm text-slate-400 leading-relaxed">
          Located in: <span className="text-slate-300">{cityName}</span>
          {cr.description && <span className="text-slate-500"> — {cr.description}</span>}
        </p>
      )
    }
    const desc = cr.pleiadesDescription
    const isCiteOnly = desc?.startsWith('An ancient place, cited:')
    const displayDesc =
      !desc || isCiteOnly ? (cr.wikiExtract ?? cr.wikidataDescription ?? cr.description) : desc
    if (!displayDesc) return null
    return (
      <p className="text-sm text-slate-300 leading-relaxed">
        {displayDesc}
        {isCiteOnly && cr.wikidataDescription && (
          <span className="text-[9px] text-slate-600 ml-1">— Wikidata</span>
        )}
      </p>
    )
  })()

  return (
    <DetailShell
      kicker="Historical Record"
      badge={
        cr.sources && cr.sources.length > 0 ? <SourcesCountBadge count={cr.sources.length} /> : null
      }
      onClose={onClose}
      hero={
        cr.imageUrl
          ? { url: cr.imageUrl, alt: cr.ancientName ?? cr.modernName ?? cr.name ?? crKey }
          : null
      }
      title={cr.ancientName ?? cr.modernName ?? cr.name ?? cr.label ?? crKey}
      subtitle={
        cr.ancientName && cr.modernName && cr.ancientName !== cr.modernName ? cr.modernName : null
      }
      subtitle2={cr.greekName ?? null}
      body={body}
      facts={facts}
      sources={cr.sources && cr.sources.length > 0 ? { chips: cr.sources } : null}
      links={
        <>
          {cr.wikiUrl && (
            <DetailLink
              href={cr.wikiUrl}
              label={cr.containedInQid ? 'Wikipedia (city)' : 'Wikipedia'}
              book
            />
          )}
          {(cr.qid || cr.containedInQid) && (
            <DetailLink
              href={`https://www.wikidata.org/wiki/${cr.qid ?? cr.containedInQid}`}
              label={cr.containedInQid && !cr.qid ? 'Wikidata (city)' : 'Wikidata'}
            />
          )}
          {pid && <DetailLink href={`https://pleiades.stoa.org/places/${pid}`} label="Pleiades" />}
          {dareId && <DetailLink href={`https://dare.ht.lu.se/places/${dareId}`} label="DARE" />}
          {/* per-record links from the entity's merged sources (vici.org etc.) */}
          <RecordSourceLinks
            lookupKeys={[crKey]}
            skipUrls={[
              ...(cr.qid ? [`https://www.wikidata.org/wiki/${cr.qid}`] : []),
              ...(pid ? [`https://pleiades.stoa.org/places/${pid}`] : []),
              ...(dareId ? [`https://dare.ht.lu.se/places/${dareId}`] : []),
            ]}
          />
          {cr.wdProps?.commonsCategory && (
            <DetailLink
              href={`https://commons.wikimedia.org/wiki/Category:${encodeURIComponent(cr.wdProps.commonsCategory)}`}
              label="Commons"
            />
          )}
        </>
      }
      connectionsEntityId={entityId}
    />
  )
}

// --- People detail (Wikidata-driven) ---

function PeopleDetailContent({ featureId }: { featureId: string }) {
  const closeFeature = useFeatureDetailStore((s) => s.closeFeature)
  const [person, setPerson] = useState<import('@/data/people-layer').NotablePerson | null>(null)
  const [wikiExtract, setWikiExtract] = useState<string | null>(null)
  const [wikiImage, setWikiImage] = useState<string | null>(null)
  const [wikiTitle, setWikiTitle] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { loadNotablePeople } = await import('@/data/people-layer')
      const people = await loadNotablePeople()
      const p = people.find((d) => d.wikidataId === featureId)
      if (cancelled) return
      if (p) setPerson(p)

      try {
        const wdResp = await fetch(
          `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${featureId}&props=sitelinks&format=json&origin=*`,
        )
        const wdData = await wdResp.json()
        const title = wdData?.entities?.[featureId]?.sitelinks?.enwiki?.title
        if (title) {
          const wikiResp = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
          )
          if (wikiResp.ok) {
            const data = await wikiResp.json()
            if (!cancelled) {
              setWikiExtract(data.extract ?? null)
              setWikiImage(data.thumbnail?.source ?? null)
              setWikiTitle(title)
            }
          }
        }
      } catch {
        // Wikipedia fetch failed — show person data without extract
      }
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [featureId])

  if (loading && !person) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-3 w-32 rounded bg-white/[0.06] animate-pulse" />
      </div>
    )
  }

  if (!person) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-500 text-sm">Person not found.</p>
      </div>
    )
  }

  const facts: DetailFact[] = [
    {
      label: 'Lived',
      value: `${formatYear(person.born)}${person.died != null ? ` – ${formatYear(person.died)}` : ''}`,
    },
  ]
  if (person.citizenship) facts.push({ label: 'Citizenship', value: person.citizenship })
  if (person.domain) facts.push({ label: 'Domain', value: person.domain })
  if (person.gender) facts.push({ label: 'Gender', value: person.gender })

  return (
    <DetailShell
      kicker="Notable Person"
      onClose={closeFeature}
      hero={wikiImage ? { url: wikiImage, alt: person.name } : null}
      title={person.name}
      kind={person.role && person.role !== 'unknown' ? person.role : null}
      body={
        wikiExtract ? <p className="text-sm text-slate-300 leading-relaxed">{wikiExtract}</p> : null
      }
      facts={facts}
      links={
        <>
          {wikiTitle && (
            <DetailLink
              href={`https://en.wikipedia.org/wiki/${encodeURIComponent(wikiTitle)}`}
              label="Wikipedia"
              book
            />
          )}
          <DetailLink
            href={`https://www.wikidata.org/wiki/${person.wikidataId}`}
            label="Wikidata"
          />
        </>
      }
    />
  )
}

// --- Empire detail (lightweight) ---

function EmpireDetailContent({ featureId }: { featureId: string }) {
  const closeFeature = useFeatureDetailStore((s) => s.closeFeature)
  const [empire, setEmpire] = useState<{
    name: string
    from: number
    to: number
    wp?: string
    qid?: string
    area: number
  } | null>(null)

  useEffect(() => {
    import('@/data/empires').then(({ loadEmpires }) =>
      loadEmpires().then((data) => {
        const e = data.find((d) => d.id === featureId)
        if (e) setEmpire(e)
      }),
    )
  }, [featureId])

  if (!empire) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-3 w-32 rounded bg-white/[0.06] animate-pulse" />
      </div>
    )
  }

  const wpUrl = empire.wp
    ? `https://en.wikipedia.org/wiki/${encodeURIComponent(empire.wp.replace(/ /g, '_'))}`
    : null
  const wdUrl = empire.qid ? `https://www.wikidata.org/wiki/${empire.qid}` : null

  const facts: DetailFact[] = [
    {
      label: 'Period',
      value: `${formatYear(empire.from)} – ${formatYear(empire.to)}`,
      source: 'Cliopatria',
    },
  ]
  if (empire.area > 0)
    facts.push({
      label: 'Area',
      value: `${Math.round(empire.area).toLocaleString()} km²`,
      source: 'Cliopatria',
    })

  return (
    <DetailShell
      kicker="Empire"
      onClose={closeFeature}
      title={empire.name}
      facts={facts}
      sources={{ chips: ['Cliopatria / Seshat Global History Databank, CC BY 4.0'] }}
      links={
        <>
          {wpUrl && <DetailLink href={wpUrl} label="Wikipedia" book />}
          {wdUrl && <DetailLink href={wdUrl} label="Wikidata" />}
        </>
      }
    />
  )
}

// --- Main content ---

function WikiDetailContent({
  featureId,
  featureLayer,
  featureEntityId,
}: {
  featureId: string
  featureLayer: string
  featureEntityId: string | null
}) {
  const closeFeature = useFeatureDetailStore((s) => s.closeFeature)
  const wikiLayer =
    featureLayer === 'crossref' || featureLayer === 'empires' || featureLayer === 'people'
      ? null
      : featureLayer === 'cities'
        ? 'settlements'
        : featureLayer
  // places knowledge is two-tier: the popup store is slim, the panel
  // wants every crossRef field — swap to the detail tier here
  const lookup = useWikiEnrichment(
    wikiLayer === 'knowledge-places'
      ? 'knowledge-places-detail'
      : wikiLayer === 'knowledge-features'
        ? 'knowledge-features-detail'
        : wikiLayer,
  )
  const crossRef = useCrossRef()

  if (featureLayer === 'empires') {
    return <EmpireDetailContent featureId={featureId} />
  }

  if (featureLayer === 'people') {
    return <PeopleDetailContent featureId={featureId} />
  }

  const loading = wikiLayer !== null && lookup === null
  const wiki = lookup?.[featureId] ?? null

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05] shrink-0">
          <div className="h-3 w-32 rounded bg-white/[0.06] animate-pulse" />
          <div className="h-6 w-6 rounded bg-white/[0.04]" />
        </div>
        <div className="p-4 sm:p-6 space-y-4">
          <div className="space-y-2">
            <div className="h-5 w-48 rounded bg-white/[0.06] animate-pulse" />
            <div className="h-3 w-24 rounded bg-white/[0.04] animate-pulse" />
          </div>
          <div className="h-px bg-white/[0.05]" />
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-white/[0.04] animate-pulse" />
            <div className="h-3 w-full rounded bg-white/[0.04] animate-pulse" />
            <div className="h-3 w-3/4 rounded bg-white/[0.04] animate-pulse" />
          </div>
          <div className="h-px bg-white/[0.05]" />
          <div className="grid grid-cols-2 gap-2">
            <div className="h-3 w-20 rounded bg-white/[0.04] animate-pulse" />
            <div className="h-3 w-28 rounded bg-white/[0.04] animate-pulse" />
            <div className="h-3 w-24 rounded bg-white/[0.04] animate-pulse" />
            <div className="h-3 w-16 rounded bg-white/[0.04] animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  if (!wiki) {
    const crOnly = crossRef?.[featureId] ?? null
    if (crOnly) {
      return (
        <CrossRefDetailContent
          cr={crOnly}
          crKey={featureId}
          entityId={featureEntityId}
          onClose={closeFeature}
        />
      )
    }
    if (
      (featureLayer === 'crossref' || featureLayer === 'knowledge-features') &&
      isCrossRefLoading()
    ) {
      return (
        <div className="space-y-4 p-6">
          <div className="h-48 rounded-lg bg-white/[0.04] animate-pulse" />
          <div className="space-y-2">
            <div className="h-5 w-48 rounded bg-white/[0.04] animate-pulse" />
            <div className="h-3 w-full rounded bg-white/[0.04] animate-pulse" />
            <div className="h-3 w-3/4 rounded bg-white/[0.04] animate-pulse" />
          </div>
        </div>
      )
    }
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-500 text-sm">No Wikipedia data found.</p>
      </div>
    )
  }

  const s = wiki.structured
  const cr = wiki.crossRef
  const heroImage =
    wiki.images?.[0] ??
    (wiki.thumbnail ? { url: wiki.thumbnail.url, caption: wiki.wikiTitle, license: '' } : null)

  // Build structured facts — academic cross-reference first, then Wikidata supplement
  const facts: DetailFact[] = []

  // Cross-reference facts (from DARE, Pleiades, ORBIS, EDH, etc.) — 100% period-accurate
  if (cr?.ancientName) facts.push({ label: 'Ancient name', value: cr.ancientName, source: 'DARE' })
  if (cr?.greekName) facts.push({ label: 'Greek', value: cr.greekName, source: 'DARE' })
  if (cr?.province) facts.push({ label: 'Province', value: cr.province, source: 'ORBIS' })
  if (cr?.startYear != null && cr.startYear !== 0)
    facts.push({
      // DARE years are attestation-range estimates, not founding dates
      label: cr.combatants ? 'Year' : 'Attested',
      value: formatYear(cr.startYear),
      source: 'DARE',
    })
  if (cr?.endYear != null && cr.endYear !== 0 && cr.endYear < 700)
    facts.push({ label: 'Until', value: formatYear(cr.endYear), source: 'DARE' })
  if (cr?.capacity) facts.push({ label: 'Capacity', value: cr.capacity.toLocaleString() })
  if (cr?.dimensions) facts.push({ label: 'Dimensions', value: cr.dimensions })
  if (cr?.combatants) facts.push({ label: 'Combatants', value: cr.combatants })
  if (cr?.commander) facts.push({ label: 'Commander', value: cr.commander })
  if (cr?.outcome) facts.push({ label: 'Outcome', value: cr.outcome })
  if (cr?.tradeRole) facts.push({ label: 'Trade role', value: cr.tradeRole, source: 'ORBIS' })
  if (cr?.buildingType) facts.push({ label: 'Type', value: cr.buildingType, source: 'Pleiades' })
  if (cr?.ancientTextMentions)
    facts.push({
      label: 'Text mentions',
      value: cr.ancientTextMentions.toLocaleString(),
      source: 'Pelagios',
    })
  if (cr?.ancientAuthors?.length)
    facts.push({
      label: 'Ancient authors',
      value: cr.ancientAuthors.join(', '),
      source: 'Pelagios',
    })

  // Wikidata supplement — only sourced claims not already covered by cross-ref
  if (s?.materials?.length && !cr) facts.push({ label: 'Material', value: s.materials.join(', ') })
  if (s?.architect) facts.push({ label: 'Architect', value: s.architect })
  if (s?.commissionedBy) facts.push({ label: 'Commissioner', value: s.commissionedBy })
  if (s?.heritageStatus) facts.push({ label: 'Heritage', value: s.heritageStatus })
  if (s?.administrativeType && !cr?.ancientName)
    facts.push({ label: 'Type', value: s.administrativeType })

  // Structured Wikidata properties from batch enrichment
  const wd = cr?.wdProps
  if (wd) {
    if (
      wd.inception &&
      inAtlasWindow(wd.inception) &&
      !facts.some((f) => f.label === 'Founded' || f.label === 'Year')
    )
      facts.push({ label: 'Founded', value: formatYear(wd.inception), source: 'Wikidata' })
    if (wd.dissolved && inAtlasWindow(wd.dissolved) && !facts.some((f) => f.label === 'Until'))
      facts.push({ label: 'Abandoned', value: formatYear(wd.dissolved), source: 'Wikidata' })
    if (wd.architect && !facts.some((f) => f.label === 'Architect'))
      facts.push({ label: 'Architect', value: wd.architect, source: 'Wikidata' })
    if (wd.commissionedBy && !facts.some((f) => f.label === 'Commissioner'))
      facts.push({ label: 'Commissioned by', value: wd.commissionedBy, source: 'Wikidata' })
    if (wd.height && hasUnit(wd.height)) facts.push({ label: 'Height', value: wd.height })
    if (wd.width && hasUnit(wd.width)) facts.push({ label: 'Width', value: wd.width })
    if (wd.length && hasUnit(wd.length) && !facts.some((f) => f.label === 'Length'))
      facts.push({ label: 'Length', value: wd.length })
    if (wd.area && hasUnit(wd.area) && !facts.some((f) => f.label === 'Area'))
      facts.push({ label: 'Area', value: wd.area })
    const mat = wd.materials?.join(', ') ?? wd.material
    if (mat && !facts.some((f) => f.label === 'Material'))
      facts.push({ label: 'Material', value: mat, source: 'Wikidata' })
    if (wd.architecturalStyle && !facts.some((f) => f.label === 'Style'))
      facts.push({ label: 'Style', value: wd.architecturalStyle, source: 'Wikidata' })
    const heritage = wd.heritageStatuses?.join(', ') ?? wd.heritageStatus
    if (heritage && !facts.some((f) => f.label === 'Heritage'))
      facts.push({ label: 'Heritage', value: heritage, source: 'Wikidata' })
    if (wd.namedAfter)
      facts.push({ label: 'Named after', value: wd.namedAfter, source: 'Wikidata' })
  }

  // slot 4 — warnings, one-line hook, narrative, additional images
  const hook = (() => {
    const source = wiki.description ?? wiki.romanEraExtract ?? wiki.extract
    if (!source) return null
    return `${source.split(/\.\s/)[0]?.trim()}.`
  })()

  const body = (
    <>
      {/* Relevance warning */}
      {wiki.wrongArticle && (
        <div className="flex items-start gap-2 p-2.5 rounded bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="size-3.5 text-red-400 shrink-0 mt-0.5" />
          <div className="text-[11px] text-red-300 leading-snug">
            <strong>Likely wrong article.</strong> {wiki.wrongArticle}. This entry may not refer to
            the historical Roman-era site.
          </div>
        </div>
      )}
      {!wiki.wrongArticle && wiki.romanRelevance != null && wiki.romanRelevance < 0.3 && (
        <div className="flex items-start gap-2 p-2.5 rounded bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="size-3.5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-[11px] text-amber-300/80 leading-snug">
            This article primarily covers the modern period. Roman-era content may be limited or
            absent.
          </div>
        </div>
      )}

      {/* One-line hook — first sentence of the resolved best description */}
      {hook && <p className="text-sm text-slate-300 leading-relaxed">{hook}</p>}

      {/* Narrative context — Pleiades description first if available */}
      {cr?.pleiadesDescription && (
        <div className="text-[13px] text-slate-300 leading-relaxed">
          {cr.pleiadesDescription}
          <span className="text-[9px] text-slate-600 ml-1">— Pleiades</span>
        </div>
      )}
      {/* Wikipedia extract — hide generic extracts when Pleiades covers it */}
      {(() => {
        if (wiki.wrongArticle) return null
        if (wiki.romanRelevance != null && wiki.romanRelevance < 0.1) return null
        if (wiki.descriptionSource !== 'custom' && cr?.pleiadesDescription) return null
        return (
          <div
            className={`text-[13px] leading-relaxed whitespace-pre-line ${cr?.pleiadesDescription ? 'text-slate-500' : 'text-slate-400'}`}
          >
            {wiki.romanEraExtract || wiki.extract}
          </div>
        )
      })()}

      {/* Additional images */}
      {wiki.images && wiki.images.length > 1 && (
        <div className="space-y-2">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
            Images
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {wiki.images.slice(1, 5).map((img, i) => (
              <div key={i} className="relative">
                <img
                  src={img.url}
                  alt={img.caption}
                  className="w-full h-20 object-cover rounded"
                  loading="lazy"
                />
                <span className="absolute bottom-0.5 right-1 text-[7px] text-white/30">
                  {img.license}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )

  // slot 6 extra — ancient text citations + Wikipedia resolution metadata
  const sourcesExtra = (
    <>
      {/* Ancient text sources from Wikidata P1343 */}
      {s?.describedIn && s.describedIn.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-[9px] uppercase tracking-wider text-slate-600">
            Ancient Text Citations
          </h4>
          {s.describedIn.map((src, i) => (
            <div key={i} className="text-[11px] text-slate-400">
              <span className="text-slate-300 italic">{src.title}</span>
              {src.author && <span className="text-slate-500"> — {src.author}</span>}
              {src.passage && <span className="text-slate-600 text-[10px]"> ({src.passage})</span>}
            </div>
          ))}
        </div>
      )}

      {/* Wikipedia metadata */}
      <div className="space-y-1">
        <h4 className="text-[9px] uppercase tracking-wider text-slate-600">Wikipedia</h4>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          {wiki.wikidataId && (
            <>
              <span className="text-slate-600">Wikidata</span>
              <span className="text-slate-400">{wiki.wikidataId}</span>
            </>
          )}
          <span className="text-slate-600">Resolved via</span>
          <span className="text-slate-400">{wiki.resolvedVia}</span>
          <span className="text-slate-600">Confidence</span>
          <span className="text-slate-400">{(wiki.confidence * 100).toFixed(0)}%</span>
          {wiki.romanRelevance != null && (
            <>
              <span className="text-slate-600">Roman relevance</span>
              <span className="text-slate-400">{(wiki.romanRelevance * 100).toFixed(0)}%</span>
            </>
          )}
        </div>
      </div>
    </>
  )

  return (
    <DetailShell
      kicker={cr ? 'Historical Record' : 'Wikipedia'}
      badge={
        cr?.sources?.length ? (
          <SourcesCountBadge count={cr.sources.length} />
        ) : (
          <SourceBadge quality={wiki.sourceQuality} />
        )
      }
      onClose={closeFeature}
      hero={
        heroImage
          ? {
              url: heroImage.url,
              alt: heroImage.caption || wiki.wikiTitle,
              license: heroImage.license || undefined,
            }
          : null
      }
      title={cr?.ancientName ?? wiki.wikiTitle}
      subtitle={
        cr?.ancientName && cr.ancientName !== wiki.wikiTitle
          ? `${wiki.wikiTitle}${cr.modernName && cr.modernName !== wiki.wikiTitle ? ` · ${cr.modernName}` : ''}`
          : null
      }
      subtitle2={cr?.greekName ?? null}
      kind={
        cr?.buildingType ??
        (featureLayer === 'cities'
          ? 'city'
          : featureLayer === 'knowledge-places'
            ? 'place'
            : featureLayer.replace(/s$/, ''))
      }
      body={body}
      facts={facts}
      sources={{ chips: cr?.sources, extra: sourcesExtra }}
      links={
        <>
          <DetailLink href={wiki.wikipediaUrl} label="Wikipedia" book />
          {wiki.wikidataUrl && <DetailLink href={wiki.wikidataUrl} label="Wikidata" />}
          {/* per-record provenance links (vici.org page, Pleiades place, ...) */}
          <RecordSourceLinks
            lookupKeys={[featureId]}
            skipUrls={wiki.wikidataUrl ? [wiki.wikidataUrl] : []}
          />
        </>
      }
      connectionsEntityId={featureEntityId}
    />
  )
}

/** Global click delegate for "Read more" buttons in map popups.
 *  Uses capture phase so the event fires before Leaflet's stopPropagation
 *  on the popup pane can swallow it during the bubble phase. */
function useReadMoreDelegate() {
  const openFeature = useFeatureDetailStore((s) => s.openFeature)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const btn = (e.target as HTMLElement).closest('.map-tooltip-readmore') as HTMLElement | null
      if (!btn) return
      const id = btn.dataset.wikiId
      const layer = btn.dataset.wikiLayer
      if (id && layer) openFeature(id, layer, btn.dataset.entityId)
    }
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [openFeature])
}

export function WikiDetailPanel() {
  useReadMoreDelegate()

  const featureId = useFeatureDetailStore((s) => s.featureId)
  const featureLayer = useFeatureDetailStore((s) => s.featureLayer)
  const featureEntityId = useFeatureDetailStore((s) => s.featureEntityId)
  const closeFeature = useFeatureDetailStore((s) => s.closeFeature)
  const isMobile = useUIStore((s) => s.isMobile)

  if (!featureId || !featureLayer) return null

  if (isMobile) {
    return (
      <Drawer
        open={!!featureId}
        onOpenChange={(open) => {
          if (!open) closeFeature()
        }}
      >
        <DrawerContent className="bg-[#0c0c10] border-white/[0.05] max-h-[80vh] flex flex-col">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Wikipedia Detail</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-contain">
            <WikiDetailContent
              featureId={featureId}
              featureLayer={featureLayer}
              featureEntityId={featureEntityId}
            />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <aside className="w-[340px] h-full shrink-0 border-l border-white/[0.05] bg-[#0c0c10] overflow-hidden flex flex-col">
      <WikiDetailContent
        featureId={featureId}
        featureLayer={featureLayer}
        featureEntityId={featureEntityId}
      />
    </aside>
  )
}
