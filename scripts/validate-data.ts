import { loadAndValidateData } from '../src/data/loader'
import { readFileSync, globSync } from 'node:fs'
import { PlaceNodeSchema, UnifiedEntitySchema } from '../src/data/schemas/place-node'

try {
  const data = loadAndValidateData()
  console.log(`✓ ${data.entities.length} entities validated`)
  console.log(`✓ ${data.connections.length} connections validated`)
  console.log(`✓ ${data.stories.length} stories validated`)

  const entityIds = new Set(data.entities.map((e) => e.id))
  let errors = 0
  for (const conn of data.connections) {
    if (!entityIds.has(conn.source)) {
      console.error(`✗ Connection ${conn.id}: source "${conn.source}" not found`)
      errors++
    }
    if (!entityIds.has(conn.target)) {
      console.error(`✗ Connection ${conn.id}: target "${conn.target}" not found`)
      errors++
    }
  }
  if (errors > 0) {
    console.error(`\n${errors} referential integrity error(s) found`)
    process.exit(1)
  }
  console.log('\n✓ All data valid')
} catch (e) {
  console.error('✗ Validation failed:', e)
  process.exit(1)
}

// --- Schema gates: canonical nodes + unified chunks (sampled for speed) ---
{
  const places = JSON.parse(readFileSync('src/data/places/places.json', 'utf-8'))
  let bad = 0
  const step = Math.max(1, Math.floor(places.length / 2000))
  for (let i = 0; i < places.length; i += step) {
    const r = PlaceNodeSchema.safeParse(places[i])
    if (!r.success) {
      if (bad < 3) console.error(`✗ PlaceNode ${places[i]?.id}: ${r.error.issues[0]?.message} @ ${r.error.issues[0]?.path.join('.')}`)
      bad++
    }
  }
  if (bad > 0) {
    console.error(`✗ places.json: ${bad} sampled records fail PlaceNodeSchema`)
    process.exit(1)
  }
  console.log(`✓ places.json: ${places.length} nodes (sampled every ${step}) pass PlaceNodeSchema`)

  const chunks = globSync('src/data/unified/*.json')
  let cbad = 0
  for (const f of chunks) {
    const arr = JSON.parse(readFileSync(f, 'utf-8'))
    const cstep = Math.max(1, Math.floor(arr.length / 300))
    for (let i = 0; i < arr.length; i += cstep) {
      const r = UnifiedEntitySchema.safeParse(arr[i])
      if (!r.success) {
        if (cbad < 3) console.error(`✗ ${f} ${arr[i]?.id}: ${r.error.issues[0]?.message} @ ${r.error.issues[0]?.path.join('.')}`)
        cbad++
      }
    }
  }
  if (cbad > 0) {
    console.error(`✗ unified chunks: ${cbad} sampled records fail UnifiedEntitySchema`)
    process.exit(1)
  }
  console.log(`✓ unified/*.json: ${chunks.length} chunks pass UnifiedEntitySchema (sampled)`)
}
