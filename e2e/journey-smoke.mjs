#!/usr/bin/env node
/**
 * Journey smoke — the stranger's first five minutes, as assertions.
 *
 * Every check here is a path a first-time visitor actually walks:
 * search the famous things, click the first result, expect a real
 * panel AND the map to take you there. This exists because "Julius
 * Caesar" → first result → "Person not found." shipped to production
 * while all the plate-level screenshot checks were green.
 *
 * Usage: node e2e/journey-smoke.mjs [baseUrl]
 *   baseUrl defaults to http://localhost:5199
 * Requires playwright (any install that `import('playwright')` resolves).
 * Each journey runs in a FRESH browser context — no state leaks between
 * them (a started story once left journey 5 with the wrong layers).
 * Exits 0 when every journey passes; prints one line per check.
 */
import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:5199'
const failures = []
const ok = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!cond) failures.push(name)
}

const browser = await chromium.launch()

/** Fresh context per journey; optional seeded layer set. */
async function journey(layers, fn) {
  const ctx = await browser.newContext({ viewport: { width: 1680, height: 950 } })
  if (layers) {
    await ctx.addInitScript(
      ([ls]) => localStorage.setItem('atlas-layers-v1', JSON.stringify(ls)),
      [layers],
    )
  }
  const page = await ctx.newPage()
  const h = {
    page,
    goto: async (path = '/') => {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(4000)
    },
    searchAndPick: async (q) => {
      const search = page.locator('input[placeholder="Search places & layers..."]').first()
      await search.click()
      await search.fill(q)
      await page.waitForTimeout(900)
      const rows = await page.locator('[role="option"]').allInnerTexts()
      await page.locator('[role="option"]').first().click()
      return rows
    },
    waitForText: async (re, timeout = 9000) => {
      try {
        await page.waitForFunction(
          (src) => new RegExp(src, 'i').test(document.body.innerText),
          re.source,
          { timeout },
        )
        return true
      } catch {
        return false
      }
    },
    mapCenter: () =>
      page.evaluate(() => {
        const m = new URLSearchParams(location.search)
        return { lat: Number(m.get('lat')), lng: Number(m.get('lng')), z: Number(m.get('z')) }
      }),
    year: () => page.evaluate(() => document.querySelector('[aria-label="Timeline year"]')?.value),
  }
  try {
    await fn(h)
  } catch (err) {
    ok(`journey crashed: ${err.message.slice(0, 80)}`, false)
  }
  await ctx.close()
}

const atRome = (c) => Math.abs(c.lat - 41.9) < 0.6 && Math.abs(c.lng - 12.5) < 0.6

// ── Journey 1: the most famous Roman ─────────────────────────────────
await journey(null, async (h) => {
  await h.goto('/')
  const rows = await h.searchAndPick('Julius Caesar')
  ok('caesar: exactly one PERSON row', rows.filter((r) => /^PERSON\nJulius Caesar/.test(r)).length === 1)
  ok('caesar: real biography loads', await h.waitForText(/dictator|Gallic Wars/))
  ok('caesar: no dead-end panel', !(await h.page.evaluate(() => document.body.innerText.includes('Person not found'))))
  await h.page.waitForTimeout(2200) // fly animation → URL sync
  const y = Number(await h.year())
  ok('caesar: timeline in his lifetime', y >= -100 && y <= -44, `year=${y}`)
  ok('caesar: map at Rome', atRome(await h.mapCenter()), JSON.stringify(await h.mapCenter()))
})

// ── Journey 2: the most famous building (start far away) ─────────────
await journey(null, async (h) => {
  await h.goto('/?year=100&lat=48&lng=2&z=5')
  await h.searchAndPick('Colosseum')
  ok('colosseum: record opens', await h.waitForText(/largest amphitheatre|Vespasian/))
  await h.page.waitForTimeout(2600)
  ok('colosseum: map flew to Rome', atRome(await h.mapCenter()), JSON.stringify(await h.mapCenter()))
})

// ── Journey 3: the city itself (start far away) ──────────────────────
await journey(null, async (h) => {
  await h.goto('/?year=100&lat=48&lng=2&z=5')
  const rows = await h.searchAndPick('Rome')
  ok('rome: City ranks first', /^CITY\nRome/.test(rows[0] ?? ''), rows[0]?.replace(/\n/g, ' · '))
  await h.page.waitForTimeout(2600)
  ok('rome: map flew there', atRome(await h.mapCenter()), JSON.stringify(await h.mapCenter()))
})

// ── Journey 4: stories open and start ────────────────────────────────
await journey(null, async (h) => {
  await h.goto('/')
  await h.page.getByRole('button', { name: /stories/i }).first().click()
  ok('stories: catalog opens', await h.waitForText(/START/))
  await h.page.getByRole('button', { name: /^start$/i }).first().click()
  ok('stories: first story starts (HUD visible)', await h.waitForText(/next|step|1\s*\/|of \d/))
})

// ── Journey 5: a battle popup reads like a title, not a stutter ──────
await journey(['showBattles'], async (h) => {
  await h.goto('/?year=-100&lat=44.8386&lng=-0.5783&z=7')
  await h.page.waitForTimeout(3000)
  await h.page.mouse.click(838, 461) // the Burdigala battle marker
  await h.page.waitForTimeout(900)
  const title = await h.page.evaluate(
    () => document.querySelector('.map-tooltip-title')?.textContent ?? '',
  )
  ok('battle: popup opens on marker click', title.length > 0, title || 'no popup')
  ok('battle: no Battle-of-Battle stutter', !/Battle of (Battle|Siege|Sack|Fall)\b/.test(title), title)
})

await browser.close()
console.log(failures.length ? `\n${failures.length} FAILURE(S)` : '\nALL JOURNEYS PASS')
process.exit(failures.length ? 1 : 0)
