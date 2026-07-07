import { useEffect, useState } from 'react'
import { X, ExternalLink, ChevronDown, BookOpen, Shield, AlertTriangle } from 'lucide-react'
import { useFeatureDetailStore } from '@/stores/useFeatureDetailStore'
import { useUIStore } from '@/stores/useUIStore'
import { Button } from '@/ui/button'
import { Separator } from '@/ui/separator'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/ui/drawer'
import { useWikiEnrichment, useCrossRef, isCrossRefLoading } from '@/hooks/useWikiEnrichment'
import { formatYear } from '@/lib/geo'
import { connections } from '@/data'
import { ConnectionList } from './ConnectionList'

// --- Source quality badge ---

function SourceBadge({ quality }: { quality?: 'academic' | 'sourced' | 'unsourced' }) {
  if (!quality) return null
  const config = {
    academic: {
      label: 'Academic',
      className: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
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

// --- Structured fact row ---

function FactRow({ label, value, source }: { label: string; value: string; source?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <span className="text-[11px] text-slate-500 shrink-0">{label}</span>
      <span className="text-[11px] text-slate-300 text-right">
        {value}
        {source && (
          <span className="ml-1 text-[9px] text-amber-500/50 italic" title={`Source: ${source}`}>
            [{source.length > 20 ? source.slice(0, 20) + '…' : source}]
          </span>
        )}
      </span>
    </div>
  )
}

// --- Cross-ref detail (lightweight panel for 94% of nodes without wiki) ---

function CrossRefDetailContent({
  cr,
  crKey,
  onClose,
}: {
  cr: import('@/data/wiki').CrossRefEnrichment
  crKey: string
  onClose: () => void
}) {
  const isDiscovery = crKey.startsWith('discovery-')
  const pid = crKey.startsWith('pleiades:')
    ? crKey.replace('pleiades:', '')
    : isDiscovery
      ? crKey.split(':')[1]
      : null
  const dareId = crKey.startsWith('settlement:') ? crKey.replace('settlement:', '') : null

  const isSettlement = crKey.startsWith('settlement:') || crKey.startsWith('pleiades:')
  const primarySrc = isSettlement ? 'DARE' : cr.sources?.[0]

  const facts: Array<{ label: string; value: string; source?: string }> = []
  if (cr.ancientName) {
    const nameLabel = isSettlement ? 'Ancient name' : 'Name'
    facts.push({ label: nameLabel, value: cr.ancientName, source: primarySrc })
  }
  if (cr.greekName) facts.push({ label: 'Greek', value: cr.greekName, source: primarySrc })
  if (cr.modernName) facts.push({ label: 'Modern', value: cr.modernName, source: primarySrc })
  if (cr.province)
    facts.push({ label: 'Province', value: cr.province, source: cr.provinceSrc ?? 'ORBIS' })
  // DARE sentinel: startYear 0 means unknown, not 1 BC
  if (cr.startYear != null && cr.startYear !== 0) {
    const yearLabel = crKey.startsWith('battle:')
      ? 'Date'
      : crKey.startsWith('amphitheater:') || crKey.startsWith('building:')
        ? 'Built'
        : 'Founded'
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/50 font-serif italic">
            Historical Record
          </span>
          {cr.sources && cr.sources.length > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider border rounded text-emerald-400 bg-emerald-400/10 border-emerald-400/20">
              <Shield className="size-2.5" />
              {cr.sources.length} source{cr.sources.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          className="text-slate-500 hover:text-slate-100"
          aria-label="Close panel"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="p-4 sm:p-6 space-y-5">
          {cr.imageUrl && (
            <div className="relative -mx-6 -mt-6">
              <img
                src={cr.imageUrl}
                alt={cr.ancientName ?? cr.modernName ?? cr.name ?? crKey}
                className="w-full object-cover max-h-52"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c10] via-transparent to-transparent" />
            </div>
          )}
          <div>
            <h2 className="font-serif italic text-xl text-slate-100 leading-tight">
              {cr.ancientName ?? cr.modernName ?? cr.name ?? crKey}
            </h2>
            {cr.ancientName && cr.modernName && cr.ancientName !== cr.modernName && (
              <span className="text-[11px] text-slate-400 block mt-0.5">{cr.modernName}</span>
            )}
            {cr.greekName && (
              <span className="text-[11px] text-slate-500 block">{cr.greekName}</span>
            )}
          </div>

          {(() => {
            const desc = cr.pleiadesDescription
            const isCiteOnly = desc?.startsWith('An ancient place, cited:')
            const displayDesc =
              !desc || isCiteOnly ? (cr.wikidataDescription ?? cr.description) : desc
            if (!displayDesc) return null
            return (
              <p className="text-sm text-slate-300 leading-relaxed">
                {displayDesc}
                {isCiteOnly && cr.wikidataDescription && (
                  <span className="text-[9px] text-slate-600 ml-1">— Wikidata</span>
                )}
              </p>
            )
          })()}

          {facts.length > 0 && (
            <>
              <Separator className="bg-white/[0.05]" />
              <div>
                {facts.map((f, i) => (
                  <FactRow key={i} label={f.label} value={f.value} source={f.source} />
                ))}
              </div>
            </>
          )}

          {cr.sources && cr.sources.length > 0 && (
            <>
              <Separator className="bg-white/[0.05]" />
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                  Sources
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {cr.sources.map((s) => (
                    <span
                      key={s}
                      className="text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            {pid && (
              <a
                href={`https://pleiades.stoa.org/places/${pid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300"
              >
                <ExternalLink className="size-3" /> Pleiades
              </a>
            )}
            {dareId && (
              <a
                href={`https://dare.ht.lu.se/places/${dareId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300"
              >
                <ExternalLink className="size-3" /> DARE
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
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
        const resp = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(featureId)}`,
          { headers: { Accept: 'application/json' } },
        )
        if (!resp.ok) {
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
        } else {
          const data = await resp.json()
          if (!cancelled) {
            setWikiExtract(data.extract ?? null)
            setWikiImage(data.thumbnail?.source ?? null)
            setWikiTitle(data.title ?? null)
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

  const wdUrl = `https://www.wikidata.org/wiki/${person.wikidataId}`

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05] shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-400/60 font-serif italic">
          Notable Person
        </span>
        <Button variant="ghost" size="sm" onClick={closeFeature} className="size-6 p-0">
          <X className="size-3.5" />
        </Button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="p-4 sm:p-6 space-y-5">
          {wikiImage && (
            <div className="relative -mx-6 -mt-6">
              <img
                src={wikiImage}
                alt={person.name}
                className="w-full object-cover max-h-52"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c10] via-transparent to-transparent" />
            </div>
          )}

          <div>
            <h2 className="font-serif italic text-xl text-slate-100 leading-tight">
              {person.name}
            </h2>
            {person.role && person.role !== 'unknown' && (
              <span className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5 block">
                {person.role}
              </span>
            )}
          </div>

          <div>
            <FactRow
              label="Lived"
              value={`${formatYear(person.born)}${person.died != null ? ` – ${formatYear(person.died)}` : ''}`}
            />
            {person.citizenship && <FactRow label="Citizenship" value={person.citizenship} />}
            {person.domain && <FactRow label="Domain" value={person.domain} />}
            {person.gender && <FactRow label="Gender" value={person.gender} />}
          </div>

          {wikiExtract && (
            <>
              <Separator className="bg-white/[0.05]" />
              <p className="text-sm text-slate-300 leading-relaxed">{wikiExtract}</p>
            </>
          )}

          <Separator className="bg-white/[0.05]" />
          <div className="flex flex-wrap gap-3">
            {wikiTitle && (
              <a
                href={`https://en.wikipedia.org/wiki/${encodeURIComponent(wikiTitle)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[11px] text-amber-500/80 hover:text-amber-400 transition-colors"
              >
                <BookOpen className="size-3" /> Wikipedia
              </a>
            )}
            <a
              href={wdUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[11px] text-amber-500/80 hover:text-amber-400 transition-colors"
            >
              <ExternalLink className="size-3" /> Wikidata
            </a>
          </div>
        </div>
      </div>
    </div>
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05] shrink-0">
        <h2 className="text-sm font-semibold text-slate-200 truncate">{empire.name}</h2>
        <Button variant="ghost" size="sm" onClick={closeFeature} className="size-6 p-0">
          <X className="size-3.5" />
        </Button>
      </div>
      <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
        <div className="space-y-1">
          <FactRow
            label="Period"
            value={`${formatYear(empire.from)} – ${formatYear(empire.to)}`}
            source="Cliopatria"
          />
          {empire.area > 0 && (
            <FactRow
              label="Area"
              value={`${Math.round(empire.area).toLocaleString()} km²`}
              source="Cliopatria"
            />
          )}
        </div>
        <Separator />
        <div className="flex flex-wrap gap-3">
          {wpUrl && (
            <a
              href={wpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[11px] text-amber-500/80 hover:text-amber-400 transition-colors"
            >
              <ExternalLink className="size-3" /> Wikipedia
            </a>
          )}
          {wdUrl && (
            <a
              href={wdUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[11px] text-amber-500/80 hover:text-amber-400 transition-colors"
            >
              <ExternalLink className="size-3" /> Wikidata
            </a>
          )}
        </div>
        <p className="text-[10px] text-slate-600 italic">
          Data: Cliopatria / Seshat Global History Databank, CC BY 4.0
        </p>
      </div>
    </div>
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
  const lookup = useWikiEnrichment(wikiLayer)
  const [sourcesExpanded, setSourcesExpanded] = useState(false)
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
    const crOnly = featureLayer === 'crossref' ? (crossRef?.[featureId] ?? null) : null
    if (crOnly) {
      return <CrossRefDetailContent cr={crOnly} crKey={featureId} onClose={closeFeature} />
    }
    if (featureLayer === 'crossref' && isCrossRefLoading()) {
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
  const facts: Array<{ label: string; value: string; source?: string }> = []

  // Cross-reference facts (from DARE, Pleiades, ORBIS, EDH, etc.) — 100% period-accurate
  if (cr?.ancientName) facts.push({ label: 'Ancient name', value: cr.ancientName, source: 'DARE' })
  if (cr?.greekName) facts.push({ label: 'Greek', value: cr.greekName, source: 'DARE' })
  if (cr?.province) facts.push({ label: 'Province', value: cr.province, source: 'ORBIS' })
  if (cr?.startYear != null && cr.startYear !== 0)
    facts.push({
      label: cr.combatants ? 'Year' : 'Founded',
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/50 font-serif italic">
            {cr ? 'Historical Record' : 'Wikipedia'}
          </span>
          {cr?.sources?.length ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider border rounded text-emerald-400 bg-emerald-400/10 border-emerald-400/20">
              <Shield className="size-2.5" />
              {cr.sources.length} sources
            </span>
          ) : (
            <SourceBadge quality={wiki.sourceQuality} />
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={closeFeature}
          className="text-slate-500 hover:text-slate-100"
          aria-label="Close wiki panel"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="p-4 sm:p-6 space-y-5">
          {/* LEVEL 1 — THE HOOK */}

          {/* Hero image */}
          {heroImage && (
            <div className="relative -mx-6 -mt-6">
              <img
                src={heroImage.url}
                alt={heroImage.caption || wiki.wikiTitle}
                className="w-full object-cover max-h-52"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c10] via-transparent to-transparent" />
              {heroImage.license && (
                <span className="absolute bottom-1 right-2 text-[8px] text-white/30">
                  {heroImage.license}
                </span>
              )}
            </div>
          )}

          {/* Title + type badge */}
          <div>
            <h2 className="font-serif italic text-xl text-slate-100 leading-tight">
              {cr?.ancientName ?? wiki.wikiTitle}
            </h2>
            {cr?.ancientName && cr.ancientName !== wiki.wikiTitle && (
              <span className="text-[11px] text-slate-400 block mt-0.5">
                {wiki.wikiTitle}
                {cr.modernName && cr.modernName !== wiki.wikiTitle ? ` · ${cr.modernName}` : ''}
              </span>
            )}
            {cr?.greekName && (
              <span className="text-[11px] text-slate-500 block">{cr.greekName}</span>
            )}
            <span className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5 block">
              {(cr?.buildingType ?? featureLayer === 'cities')
                ? 'city'
                : featureLayer.replace(/s$/, '')}
            </span>
          </div>

          {/* Relevance warning */}
          {wiki.wrongArticle && (
            <div className="flex items-start gap-2 p-2.5 rounded bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="size-3.5 text-red-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-red-300 leading-snug">
                <strong>Likely wrong article.</strong> {wiki.wrongArticle}. This entry may not refer
                to the historical Roman-era site.
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
          <p className="text-sm text-slate-300 leading-relaxed">
            {(() => {
              const source = wiki.description ?? wiki.romanEraExtract ?? wiki.extract
              if (!source) return null
              return `${source.split(/\.\s/)[0]?.trim()}.`
            })()}
          </p>

          {/* LEVEL 2 — THE STORY */}

          {facts.length > 0 && (
            <>
              <Separator />
              <div className="space-y-0.5">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-2">
                  Key Facts
                </h3>
                {facts.map((f, i) => (
                  <FactRow key={i} label={f.label} value={f.value} source={f.source} />
                ))}
              </div>
            </>
          )}

          {/* Narrative context — Pleiades description first if available */}
          <Separator />
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
            <>
              <Separator />
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
            </>
          )}

          {/* LEVEL 3 — THE EVIDENCE (expandable) */}

          {(s?.describedIn?.length || wiki.wikidataId || cr) && (
            <>
              <Separator />
              <button
                onClick={() => setSourcesExpanded(!sourcesExpanded)}
                className="flex items-center gap-2 w-full text-left group"
              >
                <BookOpen className="size-3.5 text-slate-500 group-hover:text-slate-300 transition-colors" />
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 group-hover:text-slate-300 transition-colors">
                  Sources & Evidence
                </span>
                <ChevronDown
                  className={`size-3 text-slate-500 ml-auto transition-transform ${sourcesExpanded ? 'rotate-180' : ''}`}
                />
              </button>

              {sourcesExpanded && (
                <div className="space-y-3 pl-1">
                  {/* Academic data sources */}
                  {cr?.sources && cr.sources.length > 0 && (
                    <div className="space-y-1">
                      <h4 className="text-[9px] uppercase tracking-wider text-slate-600">
                        Data Sources
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {cr.sources.map((src) => (
                          <span
                            key={src}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400 border border-white/[0.06]"
                          >
                            {src}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

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
                          {src.passage && (
                            <span className="text-slate-600 text-[10px]"> ({src.passage})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Wikipedia metadata */}
                  <div className="space-y-1">
                    <h4 className="text-[9px] uppercase tracking-wider text-slate-600">
                      Wikipedia
                    </h4>
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
                          <span className="text-slate-400">
                            {(wiki.romanRelevance * 100).toFixed(0)}%
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* External links */}
                  <div className="space-y-1.5">
                    <a
                      href={wiki.wikipediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-[11px] text-amber-500/80 hover:text-amber-400 transition-colors"
                    >
                      <ExternalLink className="size-3" />
                      Wikipedia
                    </a>
                    {wiki.wikidataUrl && (
                      <a
                        href={wiki.wikidataUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-[11px] text-amber-500/80 hover:text-amber-400 transition-colors"
                      >
                        <ExternalLink className="size-3" />
                        Wikidata
                      </a>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Curated narrative connections
              (one unified view: knowledge above, connections below) */}
          {featureEntityId && (
            <>
              <Separator className="my-4" />
              <ConnectionList entityId={featureEntityId} connections={connections} />
            </>
          )}
        </div>
      </div>
    </div>
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
