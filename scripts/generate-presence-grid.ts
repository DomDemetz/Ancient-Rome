/**
 * Generate presence density grid from DARE settlements.
 * Divides the map into 0.5° cells and computes weighted settlement
 * counts for 25-year time intervals from -500 to 500.
 *
 * Usage: npx tsx scripts/generate-presence-grid.ts
 */

import { readFile, writeFile } from 'fs/promises'
import { fileURLToPath } from 'url'

interface Settlement {
  lat: number
  lng: number
  type: number
  major: boolean
  startYear: number
  endYear: number
}

// Weight by settlement type
function getWeight(type: number, major: boolean): number {
  if (major || type === 11) return 5 // Major city
  if (type === 17) return 3 // Legionary fortress
  if (type === 18 || type === 53) return 3 // Fort / fortlet
  if (type === 12 || type === 13 || type === 35) return 2 // Settlement
  return 1 // Everything else
}

function isActive(s: Settlement, year: number): boolean {
  if (s.startYear !== 0 && s.startYear > year) return false
  if (s.endYear !== 0 && s.endYear < year) return false
  return true
}

const CELL_SIZE = 0.5
const START_YEAR = -500
const END_YEAR = 500
const INTERVAL = 25

interface GridCell {
  lat: number
  lng: number
  weights: number[] // one per time snapshot
}

async function main() {
  const settlementsPath = fileURLToPath(
    new URL('../src/data/dare/settlements.json', import.meta.url),
  )
  const settlements: Settlement[] = JSON.parse(await readFile(settlementsPath, 'utf-8'))
  console.log(`Loaded ${settlements.length} settlements`)

  const years: number[] = []
  for (let y = START_YEAR; y <= END_YEAR; y += INTERVAL) {
    years.push(y)
  }
  console.log(`Time snapshots: ${years.length} (${START_YEAR} to ${END_YEAR})`)

  // Accumulate weights per grid cell per time snapshot
  const cellMap = new Map<string, GridCell>()

  for (const s of settlements) {
    const cellLat = Math.floor(s.lat / CELL_SIZE) * CELL_SIZE
    const cellLng = Math.floor(s.lng / CELL_SIZE) * CELL_SIZE
    const key = `${cellLat},${cellLng}`
    const weight = getWeight(s.type, s.major)

    if (!cellMap.has(key)) {
      cellMap.set(key, {
        lat: cellLat,
        lng: cellLng,
        weights: new Array(years.length).fill(0),
      })
    }

    const cell = cellMap.get(key)!
    for (let i = 0; i < years.length; i++) {
      if (isActive(s, years[i])) {
        cell.weights[i] += weight
      }
    }
  }

  // Filter out cells that are all zeros
  const nonZeroCells: Array<{ lat: number; lng: number; w: number[] }> = []
  for (const cell of cellMap.values()) {
    if (cell.weights.some((w) => w > 0)) {
      nonZeroCells.push({
        lat: Math.round(cell.lat * 100) / 100,
        lng: Math.round(cell.lng * 100) / 100,
        w: cell.weights,
      })
    }
  }

  const output = {
    cellSize: CELL_SIZE,
    years,
    cells: nonZeroCells,
  }

  const json = JSON.stringify(output)
  const outPath = fileURLToPath(new URL('../src/data/dare/presence-grid.json', import.meta.url))
  await writeFile(outPath, json + '\n')
  console.log(
    `\n✓ Presence grid: ${nonZeroCells.length} cells, ${(json.length / 1024).toFixed(0)} KB`,
  )
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
