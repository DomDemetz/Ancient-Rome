/**
 * Remove DARE sentinel endYear=0 from cross-reference entries.
 * DARE uses 0 as "unknown end date" which renders as "Until: 1 AD" in the UI.
 */
import { readFile, writeFile } from 'fs/promises'

const CR_PATH = 'src/data/wiki/cross-reference.json'

async function main() {
  const cr = JSON.parse(await readFile(CR_PATH, 'utf-8'))

  let fixed = 0
  for (const [, entry] of Object.entries(cr)) {
    if ((entry as Record<string, unknown>).endYear === 0) {
      delete (entry as Record<string, unknown>).endYear
      fixed++
    }
  }

  await writeFile(CR_PATH, JSON.stringify(cr, null, 2) + '\n')
  console.log(`Fixed ${fixed} entries with sentinel endYear=0`)
}

main().catch(console.error)
