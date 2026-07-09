/**
 * Atomic JSON writes for TS scripts — counterpart of lib/atomic_json.py.
 *
 * Two sessions writing cross-reference.json concurrently tore the file on
 * 2026-07-10. fs.writeFile truncates then streams: any interruption or
 * concurrent writer leaves corruption. Writing a temp file in the same
 * directory and renaming guarantees readers only ever see a complete file.
 *
 * Use this for EVERY write under src/data:
 *   import { writeJsonAtomic } from './lib/atomic-json.js'
 *   await writeJsonAtomic(path, data, 1)   // indent optional
 */

import { writeFile, rename, unlink } from 'fs/promises'
import { dirname, join } from 'path'
import { randomBytes } from 'crypto'

export async function writeJsonAtomic(path: string, data: unknown, indent?: number): Promise<void> {
  const tmp = join(dirname(path), `.atomic-${randomBytes(6).toString('hex')}.json`)
  try {
    await writeFile(tmp, JSON.stringify(data, null, indent), 'utf-8')
    await rename(tmp, path)
  } catch (err) {
    await unlink(tmp).catch(() => {})
    throw err
  }
}
