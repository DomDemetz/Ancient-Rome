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
): string {
  if (!lookup) return html
  const wiki = lookup[id]
  if (!wiki) return html

  // Hide entries flagged as wrong articles entirely
  if (wiki.wrongArticle) return html

  // Hide entries with very low Roman relevance (< 0.1) — these are modern-city articles
  if (wiki.romanRelevance != null && wiki.romanRelevance < 0.1) return html

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

  // One structured fact as a "hook" — prefer cross-reference (academic) over Wikidata
  const cr = wiki.crossRef
  const crFact = cr ? pickCrossRefFact(cr, layer) : null
  if (crFact) {
    wikiHtml += `<div class="map-tooltip-fact">${esc(crFact)}</div>`
  } else {
    const s = wiki.structured
    if (s) {
      const fact = pickHighlightFact(s, layer)
      if (fact) wikiHtml += `<div class="map-tooltip-fact">${esc(fact)}</div>`
    }
  }

  // Source quality indicator — cross-ref is always academic
  if (cr) {
    wikiHtml += `<span class="map-tooltip-badge map-tooltip-badge--academic">${cr.sources.length} sources</span>`
  } else if (wiki.sourceQuality === 'academic') {
    wikiHtml += '<span class="map-tooltip-badge map-tooltip-badge--academic">Academic</span>'
  } else if (wiki.sourceQuality === 'sourced') {
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
  if (layer === 'battles' && cr.outcome) return `Outcome: ${cr.outcome}`
  if (layer === 'battles' && cr.combatants) return cr.combatants
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
): string {
  const desc = cr.pleiadesDescription
  const isCiteOnly = desc?.startsWith('An ancient place, cited:')

  let crHtml = '<div class="map-tooltip-wiki">'

  if (desc && !isCiteOnly) {
    const sentenceMatch = desc.match(/^(.+?\.)\s+(?=[A-Z])/)
    const first = sentenceMatch?.[1] ?? desc.split(/\.\s/)[0]
    const text = first.endsWith('.') ? first : first + '.'
    crHtml += `<div class="map-tooltip-extract">${esc(text)}</div>`
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

  if (cr.sources.length) {
    crHtml += `<span class="map-tooltip-badge map-tooltip-badge--academic">${cr.sources.length} source${cr.sources.length > 1 ? 's' : ''}</span>`
  }

  if (links) {
    crHtml += `<button class="map-tooltip-readmore" data-wiki-id="${esc(links.crKey)}" data-wiki-layer="crossref">Details</button>`
    const extLinks: string[] = []
    if (links.pid)
      extLinks.push(
        `<a href="https://pleiades.stoa.org/places/${esc(links.pid)}" target="_blank" rel="noopener noreferrer">Pleiades ↗</a>`,
      )
    if (links.qid)
      extLinks.push(
        `<a href="https://www.wikidata.org/wiki/${esc(links.qid)}" target="_blank" rel="noopener noreferrer">Wikidata ↗</a>`,
      )
    if (extLinks.length) crHtml += `<div class="map-tooltip-detail">${extLinks.join(' · ')}</div>`
  }

  crHtml += '</div>'
  return html + crHtml
}
