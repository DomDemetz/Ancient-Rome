/** Fixed anchors where the territory layer prints ROME / the eastern
 *  empire's name. ONE source of truth — TerritoryLayer renders at these,
 *  EmpiresLayer suppresses colliding polity names around them, and
 *  PlacesLayer keeps minor settlement names out from under them.
 *
 *  Each anchor exists only while its territory name actually renders
 *  (status 'controlled' in territories.json) — a claim with no name
 *  behind it silently erased OTTOMAN EMPIRE from the 1453 plate.
 *
 *  Eastern anchor by era: Anatolia while the empire's heart is there
 *  (including the Nicaean exile, 1204–1261 — the Thracian anchor sat on
 *  Latin-held land and collided with Constantinople's city label);
 *  Thrace west of the city for the late Palaiologan rump.
 */
export function imperialNameAnchors(year: number): {
  rome?: [number, number]
  'eastern-empire'?: [number, number]
} {
  return {
    ...(year < 476 && { rome: [41.1, 14.9] as [number, number] }),
    ...(year >= 395 &&
      year < 1453 && {
        'eastern-empire': (year < 1330 ? [39.2, 31.5] : [41.9, 25.4]) as [number, number],
      }),
  }
}

/** The active anchors as a plain list (for obstacle/suppression seeding). */
export function imperialAnchors(year: number): Array<[number, number]> {
  return Object.values(imperialNameAnchors(year))
}
