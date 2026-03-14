export interface Era {
  startYear: number
  endYear: number
  density: number
}

/**
 * Detects contiguous high-density eras from an array of years.
 *
 * Algorithm:
 * 1. Bins all years into 25-year buckets.
 * 2. Normalizes bucket counts to [0, 1].
 * 3. Identifies contiguous buckets above the threshold.
 * 4. Merges each contiguous group into an Era.
 */
export function detectEras(years: number[], threshold = 0.5): Era[] {
  if (years.length === 0) return []

  const BUCKET_SIZE = 25

  // Build bucket map: bucketIndex -> count
  const bucketCounts = new Map<number, number>()
  for (const year of years) {
    const bucket = Math.floor(year / BUCKET_SIZE)
    bucketCounts.set(bucket, (bucketCounts.get(bucket) ?? 0) + 1)
  }

  if (bucketCounts.size === 0) return []

  const maxCount = Math.max(...bucketCounts.values())
  if (maxCount === 0) return []

  // Sort bucket indices for contiguous detection
  const sortedBuckets = [...bucketCounts.keys()].sort((a, b) => a - b)

  // Group contiguous buckets above threshold
  const eras: Era[] = []
  let groupStart: number | null = null
  let groupEnd: number | null = null
  let groupMaxDensity = 0

  for (let i = 0; i < sortedBuckets.length; i++) {
    const bucket = sortedBuckets[i]
    const density = (bucketCounts.get(bucket) ?? 0) / maxCount

    if (density >= threshold) {
      if (groupStart === null) {
        groupStart = bucket
      }
      groupEnd = bucket
      groupMaxDensity = Math.max(groupMaxDensity, density)
    } else {
      if (groupStart !== null && groupEnd !== null) {
        eras.push({
          startYear: groupStart * BUCKET_SIZE,
          endYear: groupEnd * BUCKET_SIZE + BUCKET_SIZE - 1,
          density: groupMaxDensity,
        })
        groupStart = null
        groupEnd = null
        groupMaxDensity = 0
      }
    }
  }

  // Flush last group
  if (groupStart !== null && groupEnd !== null) {
    eras.push({
      startYear: groupStart * BUCKET_SIZE,
      endYear: groupEnd * BUCKET_SIZE + BUCKET_SIZE - 1,
      density: groupMaxDensity,
    })
  }

  return eras
}
