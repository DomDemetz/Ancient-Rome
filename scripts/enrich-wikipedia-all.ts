/**
 * Master orchestrator: runs all enrichment scripts sequentially.
 *
 * Usage: npx tsx scripts/enrich-wikipedia-all.ts
 */

import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const scriptsDir = dirname(fileURLToPath(import.meta.url))

const scripts = [
  { name: 'Script A: Entities from URLs', file: 'enrich-wikipedia-from-urls.ts' },
  { name: 'Script B: Pleiades IDs', file: 'enrich-wikipedia-from-pleiades.ts' },
  { name: 'Script C: Fuzzy matching', file: 'enrich-wikipedia-fuzzy.ts' },
]

console.log('=== Wikipedia Enrichment Pipeline ===\n')

for (const script of scripts) {
  console.log(`--- ${script.name} ---`)
  const scriptPath = join(scriptsDir, script.file)
  try {
    execSync(`npx tsx "${scriptPath}"`, {
      stdio: 'inherit',
      cwd: join(scriptsDir, '..'),
    })
    console.log()
  } catch (err) {
    console.error(`\nScript failed: ${script.name}`)
    console.error((err as Error).message)
    process.exit(1)
  }
}

console.log('=== All enrichment scripts complete ===')
