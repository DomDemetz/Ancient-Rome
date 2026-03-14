import { loadAndValidateData } from '../src/data/loader'

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
