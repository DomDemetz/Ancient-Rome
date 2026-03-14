/**
 * Formats lat/lng coordinates to a human-readable string.
 * e.g. formatCoordinates(41.9028, 12.4964) => "41.9028°N, 12.4964°E"
 */
export function formatCoordinates(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S'
  const lngDir = lng >= 0 ? 'E' : 'W'
  const absLat = Math.abs(lat).toFixed(4)
  const absLng = Math.abs(lng).toFixed(4)
  return `${absLat}°${latDir}, ${absLng}°${lngDir}`
}

/**
 * Formats a year number to a human-readable string with BC/AD notation.
 * e.g. formatYear(-44) => "44 BC"
 *      formatYear(476)  => "476 AD"
 *      formatYear(0)    => "1 BC" (astronomical year 0 = 1 BC)
 */
export function formatYear(year: number): string {
  if (year < 0) {
    return `${Math.abs(year)} BC`
  }
  if (year === 0) {
    return '1 BC'
  }
  return `${year} AD`
}
