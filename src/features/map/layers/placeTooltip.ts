import type { PlaceNode } from '@/data/places'
import { esc } from '@/lib/wiki-popup'
import { formatYear } from '@/lib/geo'
import { DARE_TYPE_LABELS, DARE_TYPE_TO_CATEGORY, CATEGORY_STYLES } from './settlementStyles'

/** ORBIS siteType → popup wording (a place's role in the trade network). */
export const TRADE_ROLE_LABELS: Record<string, string> = {
  major_port: 'Major trade port',
  port: 'Trade port',
  city: 'Trade hub',
  junction: 'Route junction',
}

export function fmtPop(pop: number): string {
  if (pop >= 1000000) return `${(pop / 1000000).toFixed(1)}M`
  if (pop >= 1000) return `${Math.round(pop / 1000)}K`
  return String(pop)
}

/** Period-correct display name for the handful of famous renames. */
export function displayName(p: PlaceNode, year: number): string {
  if (p.name === 'Constantinople' && year < 330) return 'Byzantium'
  return p.name
}

/** Base popup HTML for a canonical place node (before wiki enrichment). */
export function baseTooltipHtml(
  p: PlaceNode,
  name: string,
  pop: number | null,
  year: number,
): string {
  let html = `<div class="map-tooltip-title">${esc(name)}</div>`
  const sub: string[] = []
  if (p.modern && p.modern !== name) sub.push(esc(p.modern))
  if (sub.length) html += `<div class="map-tooltip-sub">${sub.join(' · ')}</div>`

  const t = p.dare?.type
  const typeLabel = t != null ? DARE_TYPE_LABELS[t] : null
  const category = t != null ? DARE_TYPE_TO_CATEGORY[t] : null
  const categoryLabel = category ? CATEGORY_STYLES[category].label : null
  const details: string[] = []
  const typeParts = [typeLabel, categoryLabel].filter(Boolean).join(' · ')
  if (typeParts) details.push(typeParts)
  if (pop != null && pop > 0) details.push(`Pop: ~${fmtPop(pop)}`)
  if (p.startYear !== 0 || p.endYear !== 0) {
    const start = p.startYear !== 0 ? formatYear(p.startYear) : '?'
    const end = p.endYear !== 0 ? formatYear(Math.min(p.endYear, 1453)) : '?'
    details.push(`${start} – ${end}`)
  }
  if (p.vici?.length)
    details.push(`${p.vici.length} archaeological site${p.vici.length > 1 ? 's' : ''}`)
  if (p.orbis) details.push(TRADE_ROLE_LABELS[p.orbis.type] ?? 'Trade site')
  if (p.near) details.push(`${p.near[1]} km ${p.near[2]} of ${esc(p.near[0])}`)
  if (details.length) html += `<div class="map-tooltip-detail">${details.join(' · ')}</div>`
  if (year >= 0 && pop != null && pop > 0) {
    // population is the one time-varying fact; date it
    html = html.replace(`Pop: ~${fmtPop(pop)}`, `Pop: ~${fmtPop(pop)} (${year} AD)`)
  }
  return html
}
