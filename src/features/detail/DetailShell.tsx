import { useState, type ReactNode } from 'react'
import { X, BookOpen, ChevronDown, ExternalLink } from 'lucide-react'
import { Button } from '@/ui/button'
import { Separator } from '@/ui/separator'
import { connections } from '@/data'
import { ConnectionList } from './ConnectionList'

/**
 * THE detail panel shell — one display contract for every side panel
 * (Dominik 2026-07-11: display must not vary by which data path an entity
 * fell through; same rule as buildPopup in src/lib/wiki-popup.ts).
 * Eight slots, always in this order; empty slots vanish without changing
 * the structure:
 *   1 header (kicker · badge · close)
 *   2 hero image
 *   3 title + subtitle lines + kind
 *   4 body (extract/description paragraphs, warnings, extra images)
 *   5 facts (FactRow list)
 *   6 sources (uniform "Sources & Evidence" collapsible: chips + extra)
 *   7 external links row (Wikipedia/Wikidata/Pleiades/DARE/RecordSourceLinks)
 *   8 connections (ConnectionList)
 * Variants are thin content-mappers that feed these slots — they never
 * render their own chrome.
 */

export interface DetailFact {
  label: string
  value: string
  source?: string
}

export function FactRow({ label, value, source }: DetailFact) {
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

/** One uniform external-link style for slot 7 (matches RecordSourceLinks). */
export function DetailLink({
  href,
  label,
  book,
}: {
  href: string
  label: string
  /** use the BookOpen icon (Wikipedia links) instead of the generic arrow */
  book?: boolean
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300"
    >
      {book ? <BookOpen className="size-3" /> : <ExternalLink className="size-3" />} {label}
    </a>
  )
}

export interface DetailShellProps {
  /** slot 1: kicker text, e.g. 'Historical Record' / 'Wikipedia' */
  kicker: string
  /** slot 1: optional badge next to the kicker (source count, quality) */
  badge?: ReactNode
  onClose: () => void
  /** slot 2 */
  hero?: { url: string; alt: string; license?: string } | null
  /** slot 3 */
  title: string
  /** slot 3: brighter secondary line (modern name, wiki title) */
  subtitle?: string | null
  /** slot 3: dimmer tertiary line (Greek name) */
  subtitle2?: string | null
  /** slot 3: uppercase kind/type line (building type, person role) */
  kind?: string | null
  /** slot 4: extract/description paragraphs, warnings, extra images */
  body?: ReactNode
  /** slot 5 */
  facts?: DetailFact[]
  /** slot 6: source-name chips + optional extra evidence content */
  sources?: { chips?: string[]; extra?: ReactNode } | null
  /** slot 7: external links (DetailLink / RecordSourceLinks nodes) */
  links?: ReactNode
  /** slot 8: entity id for ConnectionList */
  connectionsEntityId?: string | null
}

export function DetailShell({
  kicker,
  badge,
  onClose,
  hero,
  title,
  subtitle,
  subtitle2,
  kind,
  body,
  facts,
  sources,
  links,
  connectionsEntityId,
}: DetailShellProps) {
  const [sourcesExpanded, setSourcesExpanded] = useState(false)
  const hasSources = !!(sources && ((sources.chips?.length ?? 0) > 0 || sources.extra))

  return (
    <div className="flex flex-col h-full">
      {/* 1 — header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/50 font-serif italic">
            {kicker}
          </span>
          {badge}
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
          {/* 2 — hero image */}
          {hero && (
            <div className="relative -mx-6 -mt-6">
              <img
                src={hero.url}
                alt={hero.alt}
                className="w-full object-cover max-h-52"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c10] via-transparent to-transparent" />
              {hero.license && (
                <span className="absolute bottom-1 right-2 text-[8px] text-white/30">
                  {hero.license}
                </span>
              )}
            </div>
          )}

          {/* 3 — title + subtitle */}
          <div>
            <h2 className="font-serif italic text-xl text-slate-100 leading-tight">{title}</h2>
            {subtitle && (
              <span className="text-[11px] text-slate-400 block mt-0.5">{subtitle}</span>
            )}
            {subtitle2 && <span className="text-[11px] text-slate-500 block">{subtitle2}</span>}
            {kind && (
              <span className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5 block">
                {kind}
              </span>
            )}
          </div>

          {/* 4 — extract/description */}
          {body}

          {/* 5 — facts */}
          {facts && facts.length > 0 && (
            <>
              <Separator className="bg-white/[0.05]" />
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

          {/* 6 — sources & evidence (uniform collapsible) */}
          {hasSources && (
            <>
              <Separator className="bg-white/[0.05]" />
              <button
                onClick={() => setSourcesExpanded(!sourcesExpanded)}
                className="flex items-center gap-2 w-full text-left group"
              >
                <BookOpen className="size-3.5 text-slate-500 group-hover:text-slate-300 transition-colors" />
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 group-hover:text-slate-300 transition-colors">
                  Sources &amp; Evidence
                </span>
                <ChevronDown
                  className={`size-3 text-slate-500 ml-auto transition-transform ${sourcesExpanded ? 'rotate-180' : ''}`}
                />
              </button>
              {sourcesExpanded && (
                <div className="space-y-3 pl-1">
                  {sources?.chips && sources.chips.length > 0 && (
                    <div className="space-y-1">
                      <h4 className="text-[9px] uppercase tracking-wider text-slate-600">
                        Data Sources
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {sources.chips.map((src) => (
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
                  {sources?.extra}
                </div>
              )}
            </>
          )}

          {/* 7 — external links row */}
          {links && <div className="flex flex-wrap gap-2 pt-2">{links}</div>}

          {/* 8 — connections */}
          {connectionsEntityId && (
            <>
              <Separator className="my-4" />
              <ConnectionList entityId={connectionsEntityId} connections={connections} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
