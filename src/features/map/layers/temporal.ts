/**
 * THE temporal policy — one rule set for "is this thing visible in year Y",
 * replacing per-layer date folklore (Dominik 2026-07-11: standardize).
 *
 * Semantics (matches the data contract: dates exist ONLY when a source
 * attests them — we never invent data):
 *   - start/end absent, 0, or null  → UNKNOWN, not "always" and not "never".
 *   - unknown start → visible (undated archaeology rides with its zoom
 *     tier; hiding it would empty half the map).
 *   - unknown end   → visible after start (no invented abandonment)...
 *     EXCEPT where a documented exception below says otherwise.
 *
 * Documented exceptions (the ONLY places these rules may live):
 *   - DARE_HORIZON: DARE-only settlement nodes without an attested end stop
 *     at the archaeological data horizon (~800 AD) — PlacesLayer.
 *   - TERRITORY_LAG: undated vici sites correlated to a territory become
 *     visible 20y after conquest, fade 50y after loss.
 *   - ROMAN_ROAD_DAWN: never-dated Roman roads dawn with the Via Appia
 *     (312 BC) — road-style.ts.
 */

export const DARE_HORIZON = 800
export const TERRITORY_LAG_IN = 20
export const TERRITORY_LAG_OUT = 50
export const ROMAN_ROAD_DAWN = -312

/** The one visibility test. 0/null/undefined = unknown (see module doc). */
export function inWindow(
  start: number | null | undefined,
  end: number | null | undefined,
  year: number,
): boolean {
  if (start != null && start !== 0 && start > year) return false
  if (end != null && end !== 0 && end < year) return false
  return true
}

/** Territory-correlated undated sites (vici): visible TERRITORY_LAG_IN
 *  years after control begins, gone TERRITORY_LAG_OUT after decline. */
export function inTerritoryWindow(
  territoryYear: number | null | undefined,
  declineYear: number | null | undefined,
  year: number,
): boolean {
  if (territoryYear == null) return true
  if (year < territoryYear + TERRITORY_LAG_IN) return false
  if (declineYear != null && year > declineYear + TERRITORY_LAG_OUT) return false
  return true
}
