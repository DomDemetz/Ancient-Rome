import type { WikiLookup, CrossRefEnrichment } from '@/data/wiki'
import { formatYear } from '@/lib/geo'

/** Escape HTML special characters to prevent XSS from external data */
export function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Appends Wikipedia enrichment to popup HTML if wiki data exists for the given ID.
 * Shows thumbnail, first sentence, one structured fact (when available), and a "Read more" button.
 */
export function appendWikiTooltip(
  html: string,
  id: string,
  lookup: WikiLookup | null,
  layer: string,
  entityId?: string,
  opts?: { noBadge?: boolean },
): string {
  if (!lookup) return html
  const wiki = lookup[id]
  if (!wiki) return html

  // Hide entries flagged as wrong articles entirely
  if (wiki.wrongArticle) return html

  // Hide entries with very low Roman relevance (< 0.1) — these are modern-city articles.
  // Exception: entries with a description or romanEraExtract were deliberately enriched.
  if (
    wiki.romanRelevance != null &&
    wiki.romanRelevance < 0.1 &&
    !wiki.description &&
    !wiki.romanEraExtract
  )
    return html

  let wikiHtml = '<div class="map-tooltip-wiki">'

  // Prefer Wikimedia Commons image over Wikipedia thumbnail
  const imgUrl = wiki.images?.[0]?.url ?? wiki.thumbnail?.url
  if (imgUrl) {
    wikiHtml += `<img class="map-tooltip-thumb" src="${esc(imgUrl)}" alt="" />`
  }

  const extractSource = wiki.description ?? wiki.romanEraExtract ?? wiki.extract
  const sentenceMatch = extractSource?.match(/^(.+?\.)\s+(?=[A-Z])/)
  const firstSentence = sentenceMatch?.[1] ?? extractSource?.split(/\.\s/)[0]
  if (firstSentence) {
    const text = firstSentence.endsWith('.') ? firstSentence : firstSentence + '.'
    wikiHtml += `<div class="map-tooltip-extract">${esc(text)}</div>`
  }

  // One structured fact as a "hook" — prefer cross-reference (academic) over Wikidata.
  // Graph-keyed ids carry their type as prefix ('amphitheater:x') — recover
  // the fact-picking layer from it so capacity/outcome facts survive the
  // knowledge-features migration.
  const factLayer =
    layer === 'knowledge-features' && id.includes(':') ? `${id.split(':')[0]}s` : layer
  const cr = wiki.crossRef
  const crFact = cr ? pickCrossRefFact(cr, factLayer) : null
  if (crFact) {
    wikiHtml += `<div class="map-tooltip-fact">${esc(crFact)}</div>`
  } else {
    const s = wiki.structured
    if (s) {
      const fact = pickHighlightFact(s, factLayer)
      if (fact) wikiHtml += `<div class="map-tooltip-fact">${esc(fact)}</div>`
    }
  }

  // Source quality indicator — cross-ref is always academic
  if (cr?.sources?.length) {
    if (!opts?.noBadge)
      wikiHtml += `<span class="map-tooltip-badge map-tooltip-badge--academic">${cr.sources.length} sources</span>`
  } else if (wiki.sourceQuality === 'academic') {
    if (!opts?.noBadge)
      wikiHtml += '<span class="map-tooltip-badge map-tooltip-badge--academic">Academic</span>'
  } else if (wiki.sourceQuality === 'sourced') {
    if (!opts?.noBadge)
      wikiHtml += '<span class="map-tooltip-badge map-tooltip-badge--sourced">Sourced</span>'
  }

  wikiHtml += `<button class="map-tooltip-readmore" data-wiki-id="${esc(id)}" data-wiki-layer="${esc(layer)}"${entityId ? ` data-entity-id="${esc(entityId)}"` : ''}>Read more</button>`
  wikiHtml += '</div>'

  return html + wikiHtml
}

/**
 * Pick the most interesting cross-reference fact to show in the popup.
 * Cross-ref data is 100% period-accurate from academic sources.
 */
function pickCrossRefFact(
  cr: NonNullable<import('@/data/wiki').WikiEnrichment['crossRef']>,
  layer: string,
): string | null {
  if (layer === 'amphitheaters' && cr.capacity) return `Capacity: ${cr.capacity.toLocaleString()}`
  // no outcome/combatants here: the battle base tooltip already states both
  // — the popup was saying 'Outcome: defeat' twice
  if (layer === 'settlements' && cr.province) return `Province: ${cr.province}`
  if (layer === 'buildings' && cr.buildingType) return cr.buildingType
  if (cr.ancientTextMentions && cr.ancientTextMentions > 100) {
    return `${cr.ancientTextMentions.toLocaleString()} ancient text mentions`
  }
  if (cr.province) return `Province: ${cr.province}`
  return null
}

/**
 * Pick the single most interesting structured fact to show in the popup.
 */
function pickHighlightFact(
  s: NonNullable<import('@/data/wiki').WikiEnrichment['structured']>,
  layer: string,
): string | null {
  // Amphitheaters: capacity is the wow factor
  if (layer === 'amphitheaters') {
    if (s.dimensions?.capacity) return `Capacity: ${s.dimensions.capacity.toLocaleString()}`
    if (s.inceptionYear) return `Built: ${formatYear(s.inceptionYear)}`
  }

  // Battles: winner or casualties
  if (layer === 'battles') {
    if (s.winner) return `Victor: ${s.winner}`
    if (s.casualties) return `Casualties: ${s.casualties.toLocaleString()}`
  }

  // Settlements: administrative type
  if (layer === 'settlements') {
    if (s.administrativeType) return `Status: ${s.administrativeType}`
    if (s.inceptionYear) return `Founded: ${formatYear(s.inceptionYear)}`
  }

  // Buildings: patron or architect
  if (layer === 'buildings') {
    if (s.commissionedBy) return `By: ${s.commissionedBy}`
    if (s.architect) return `Architect: ${s.architect}`
  }

  // Generic fallback
  if (s.inceptionYear) return `${formatYear(s.inceptionYear)}`
  if (s.heritageStatus) return s.heritageStatus

  return null
}

export function appendCrossRefTooltip(
  html: string,
  cr: CrossRefEnrichment,
  links?: { crKey: string; pid?: string; qid?: string },
  opts?: { noBadge?: boolean },
): string {
  const isContainer = !!cr.containedInQid
  const desc = cr.pleiadesDescription
  const isCiteOnly = desc?.startsWith('An ancient place, cited:')

  let crHtml = '<div class="map-tooltip-wiki">'

  if (cr.imageUrl) {
    crHtml += `<img class="map-tooltip-thumb" src="${esc(cr.imageUrl)}" alt="" />`
  }

  if (isContainer) {
    const cityName = cr.wikiUrl
      ? decodeURIComponent(cr.wikiUrl.split('/wiki/').pop() ?? '').replace(/_/g, ' ')
      : (cr.label ?? null)
    if (cityName) {
      const cityDesc = cr.description ? ` — ${cr.description}` : ''
      crHtml += `<div class="map-tooltip-extract">Located in: ${esc(cityName)}${esc(cityDesc)}</div>`
    }
  } else {
    const displayDesc = desc && !isCiteOnly ? desc : (cr.wikidataDescription ?? cr.description)
    if (displayDesc) {
      const sentenceMatch = displayDesc.match(/^(.+?\.)\s+(?=[A-Z])/)
      const first = sentenceMatch?.[1] ?? displayDesc.split(/\.\s/)[0]
      const text = first.endsWith('.') ? first : first + '.'
      crHtml += `<div class="map-tooltip-extract">${esc(text)}</div>`
    }
  }

  const facts: string[] = []
  if (cr.province) facts.push(`Province: ${cr.province}`)
  if (cr.tradeRole && cr.tradeRole !== 'city') facts.push(`Trade: ${cr.tradeRole}`)
  if (isCiteOnly && desc) {
    const ref = desc.replace('An ancient place, cited: ', '')
    facts.push(ref)
  }
  if (facts.length) {
    crHtml += `<div class="map-tooltip-fact">${esc(facts.join(' · '))}</div>`
  }

  if (cr.ancientAuthors?.length) {
    crHtml += `<div class="map-tooltip-fact">${esc('Cited by: ' + cr.ancientAuthors.join(', '))}</div>`
  }

  if (cr.sources?.length) {
    if (!opts?.noBadge)
      crHtml += `<span class="map-tooltip-badge map-tooltip-badge--academic">${cr.sources.length} source${cr.sources.length > 1 ? 's' : ''}</span>`
  }

  if (links) {
    crHtml += `<button class="map-tooltip-readmore" data-wiki-id="${esc(links.crKey)}" data-wiki-layer="crossref">Details</button>`
  }

  crHtml += '</div>'
  return html + crHtml
}

/**
 * THE popup shell — one display contract for every map popup (Dominik
 * 2026-07-11: display must not vary by which data path an entity fell
 * through). Five slots, always in this order; empty slots vanish without
 * changing the structure:
 *   title · sub (kind/type) · details (dates, facts-in-brief) ·
 *   body (extract/facts html from appendWiki/CrossRefTooltip) ·
 *   footer (source line + read-more)
 */
export interface PopupSlots {
  title: string
  sub?: string
  details?: string[]
  /** pre-built enrichment html (appendWikiTooltip / appendCrossRefTooltip output body) */
  bodyHtml?: string
  source?: string
  readMore?: { id: string; layer: string; entityId?: string; label?: string }
}

export function buildPopup(slots: PopupSlots): string {
  let html = `<div class="map-tooltip-title">${esc(slots.title)}</div>`
  if (slots.sub && slots.sub !== slots.title) {
    html += `<div class="map-tooltip-sub">${esc(slots.sub)}</div>`
  }
  for (const d of slots.details ?? []) {
    html += `<div class="map-tooltip-detail">${esc(d)}</div>`
  }
  if (slots.source) {
    html += `<div class="map-tooltip-fact">Source: ${esc(slots.source)}</div>`
  }
  if (slots.bodyHtml) html += slots.bodyHtml
  if (slots.readMore && !slots.bodyHtml?.includes('map-tooltip-readmore')) {
    const rm = slots.readMore
    // the button carries the minimal record so the panel can render
    // title/kind/dates even when no knowledge entry exists
    const fb =
      ` data-fb-title="${esc(slots.title)}"` +
      (slots.sub ? ` data-fb-kind="${esc(slots.sub)}"` : '') +
      (slots.details?.[0] ? ` data-fb-dates="${esc(slots.details[0])}"` : '')
    html += `<div class="map-tooltip-wiki"><button class="map-tooltip-readmore" data-wiki-id="${esc(rm.id)}" data-wiki-layer="${esc(rm.layer)}"${rm.entityId ? ` data-entity-id="${esc(rm.entityId)}"` : ''}${fb}>${esc(rm.label ?? 'Details')}</button></div>`
  }
  return html
}
