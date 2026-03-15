/**
 * Analyze all unique placeTypes in the Pleiades dataset and count
 * how many entries have coordinates (reprPoint) for each type.
 *
 * Usage: npx tsx scripts/analyze-pleiades.ts
 */

import { createReadStream, createWriteStream } from 'fs'
import { unlink } from 'fs/promises'
import { createGunzip } from 'zlib'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { tmpdir } from 'os'
import { join } from 'path'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GEOJSON_URL = 'https://atlantides.org/downloads/pleiades/json/pleiades-places-latest.json.gz'

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

async function downloadToTempFile(url: string): Promise<string> {
  console.log(`Downloading ${url} ...`)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`)
  }
  if (!res.body) {
    throw new Error('No response body')
  }

  const tmpFile = join(tmpdir(), `pleiades-analyze-${Date.now()}.json`)
  console.log(`Streaming to temp file: ${tmpFile}`)

  const nodeStream = Readable.fromWeb(res.body as import('stream/web').ReadableStream)
  const gunzip = createGunzip()
  const outStream = createWriteStream(tmpFile)

  await pipeline(nodeStream, gunzip, outStream)

  console.log('Download and decompression complete.\n')
  return tmpFile
}

// ---------------------------------------------------------------------------
// Streaming JSON parser (reused pattern from ingest-pleiades-buildings.ts)
// ---------------------------------------------------------------------------

interface PlaceTypeStat {
  total: number
  withCoords: number
}

async function streamAnalyzePlaces(filePath: string): Promise<Map<string, PlaceTypeStat>> {
  console.log('Stream-parsing places from JSON file...')

  return new Promise((resolve, reject) => {
    const stats = new Map<string, PlaceTypeStat>()
    let buffer = ''
    let inGraph = false
    let depth = 0
    let objectStart = -1
    let placesProcessed = 0
    let inString = false
    let escape = false
    let searchBuffer = ''

    const stream = createReadStream(filePath, {
      encoding: 'utf-8',
      highWaterMark: 1024 * 1024,
    })

    function processObject(objStr: string) {
      placesProcessed++

      if (placesProcessed % 10000 === 0) {
        console.log(`  Processed ${placesProcessed} places...`)
      }

      try {
        const place = JSON.parse(objStr)
        const placeTypes: string[] = place.placeTypes || []
        const types = Array.isArray(placeTypes) ? placeTypes : [placeTypes]

        const hasCoords =
          place.reprPoint &&
          Array.isArray(place.reprPoint) &&
          place.reprPoint.length >= 2 &&
          typeof place.reprPoint[0] === 'number' &&
          typeof place.reprPoint[1] === 'number'

        // If no placeTypes, count as "untyped"
        const effectiveTypes = types.length > 0 ? types : ['(untyped)']

        for (const t of effectiveTypes) {
          const key = String(t).trim() || '(empty string)'
          let stat = stats.get(key)
          if (!stat) {
            stat = { total: 0, withCoords: 0 }
            stats.set(key, stat)
          }
          stat.total++
          if (hasCoords) stat.withCoords++
        }
      } catch {
        // Skip malformed objects
      }
    }

    stream.on('data', (chunk: string) => {
      for (let i = 0; i < chunk.length; i++) {
        const ch = chunk[i]

        if (!inGraph) {
          searchBuffer += ch
          if (searchBuffer.length > 20) {
            searchBuffer = searchBuffer.slice(-20)
          }
          if (searchBuffer.includes('"@graph"')) {
            inGraph = true
            searchBuffer = ''
            buffer = ''
            depth = 0
            objectStart = -1
            inString = false
            escape = false
          }
          continue
        }

        buffer += ch

        if (escape) {
          escape = false
          continue
        }

        if (ch === '\\' && inString) {
          escape = true
          continue
        }

        if (ch === '"') {
          inString = !inString
          continue
        }

        if (inString) continue

        if (ch === '{') {
          if (depth === 0) {
            objectStart = buffer.length - 1
          }
          depth++
        } else if (ch === '}') {
          depth--
          if (depth === 0 && objectStart >= 0) {
            const objStr = buffer.slice(objectStart)
            processObject(objStr)
            buffer = ''
            objectStart = -1
          }
        } else if (ch === ']' && depth === 0) {
          console.log(`  Finished processing ${placesProcessed} total places.\n`)
          stream.destroy()
          resolve(stats)
          return
        }

        if (depth === 0 && objectStart === -1 && buffer.length > 100) {
          buffer = ''
        }
      }
    })

    stream.on('end', () => {
      console.log(`  Stream ended after ${placesProcessed} places.\n`)
      resolve(stats)
    })

    stream.on('error', (err) => {
      reject(err)
    })
  })
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Analyzing Pleiades place types...\n')

  let tmpFile: string
  try {
    tmpFile = await downloadToTempFile(GEOJSON_URL)
  } catch (err) {
    console.error(`Download failed: ${(err as Error).message}`)
    process.exit(1)
  }

  try {
    const stats = await streamAnalyzePlaces(tmpFile)

    // Sort by total count descending
    const sorted = [...stats.entries()].sort((a, b) => b[1].total - a[1].total)

    // Print results
    const nameWidth = 40
    const header = `${'Place Type'.padEnd(nameWidth)} ${'Total'.padStart(8)} ${'With Coords'.padStart(12)}`
    console.log(header)
    console.log('-'.repeat(header.length))

    let grandTotal = 0
    let grandWithCoords = 0

    for (const [type, stat] of sorted) {
      const pct = stat.total > 0 ? ((stat.withCoords / stat.total) * 100).toFixed(0) : '0'
      console.log(
        `${type.padEnd(nameWidth)} ${String(stat.total).padStart(8)} ${String(stat.withCoords).padStart(12)}  (${pct}%)`,
      )
      grandTotal += stat.total
      grandWithCoords += stat.withCoords
    }

    console.log('-'.repeat(header.length))
    console.log(
      `${'TOTAL (entries x types)'.padEnd(nameWidth)} ${String(grandTotal).padStart(8)} ${String(grandWithCoords).padStart(12)}`,
    )
    console.log(`\nUnique place types: ${sorted.length}`)
  } finally {
    try {
      await unlink(tmpFile)
      console.log('Cleaned up temp file.')
    } catch {
      // ignore
    }
  }
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
