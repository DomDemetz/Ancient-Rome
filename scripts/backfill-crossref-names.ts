import { readFile, writeFile } from 'fs/promises'

const CR_PATH = 'src/data/wiki/cross-reference.json'

interface CrossRefEntry {
  ancientName?: string
  modernName?: string
  sources: string[]
  [key: string]: unknown
}

interface PlaceNode {
  id: string
  name: string
  pid?: string
  dare?: { id: string; modern?: string }
}

async function main() {
  const crossRef: Record<string, CrossRefEntry> = JSON.parse(await readFile(CR_PATH, 'utf-8'))
  const places: PlaceNode[] = JSON.parse(await readFile('src/data/places/places.json', 'utf-8'))

  const byPid = new Map<string, PlaceNode>()
  for (const p of places) {
    if (p.pid) byPid.set(p.pid, p)
  }

  const amphs = JSON.parse(await readFile('src/data/amphitheaters/amphitheaters.json', 'utf-8'))
  const amphById = new Map<string, string>()
  for (const a of amphs) amphById.set(a.id, a.name)

  const buildings = JSON.parse(await readFile('src/data/buildings/buildings.json', 'utf-8'))
  const buildingById = new Map<string, string>()
  for (const b of buildings) buildingById.set(b.id, b.name)

  const battles = JSON.parse(await readFile('src/data/battles/battles.json', 'utf-8'))
  const battleById = new Map<string, string>()
  for (const b of battles) battleById.set(b.id, b.name)

  let fixed = 0

  for (const [key, entry] of Object.entries(crossRef)) {
    if (entry.ancientName) continue

    const [prefix, id] = key.split(':')

    if (prefix === 'pleiades') {
      const p = byPid.get(id)
      if (p) {
        entry.ancientName = p.name
        if (p.dare?.modern) entry.modernName = p.dare.modern
        fixed++
      }
    } else if (prefix === 'amphitheater') {
      const name = amphById.get(id)
      if (name) {
        entry.ancientName = name
        fixed++
      }
    } else if (prefix === 'building') {
      const name = buildingById.get(id)
      if (name) {
        entry.ancientName = name
        fixed++
      }
    } else if (prefix === 'battle') {
      const name = battleById.get(id)
      if (name) {
        entry.ancientName = name
        fixed++
      }
    }
  }

  await writeFile(CR_PATH, JSON.stringify(crossRef, null, 2) + '\n')
  console.log(`Backfilled ${fixed} entries with names.`)

  const still = Object.values(crossRef).filter((e) => !e.ancientName && !e.modernName).length
  console.log(`Still nameless: ${still}`)
}

main().catch(console.error)
