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
const ctx = await browser.newContext({ viewport: { width: 1680, height: 950 } })
const page = await ctx.newPage()
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(7000)

const search = page.locator('input[placeholder="Search places & layers..."]').first()
const mapCenter = () =>
  page.evaluate(() => {
    const m = new URLSearchParams(location.search)
    return { lat: Number(m.get('lat')), lng: Number(m.get('lng')), z: Number(m.get('z')) }
  })
const year = () =>
  page.evaluate(() => document.querySelector('[aria-label="Timeline year"]')?.value)
const bodyText = () => page.evaluate(() => document.body.innerText)

async function searchAndPick(q) {
  await search.click()
  await search.fill(q)
  await page.waitForTimeout(900)
  const rows = await page.locator('[role="option"]').allInnerTexts()
  await page.locator('[role="option"]').first().click()
  await page.waitForTimeout(2600) // fly animation + panel load
  return rows
}

// ── Journey 1: the most famous Roman ─────────────────────────────────
{
  const rows = await searchAndPick('Julius Caesar')
  const txt = await bodyText()
  ok('caesar: exactly one PERSON row', rows.filter((r) => /^PERSON\nJulius Caesar/.test(r)).length === 1)
  ok('caesar: no dead-end panel', !txt.includes('Person not found'))
  ok('caesar: real biography', /dictator|Gallic Wars/i.test(txt))
  ok('caesar: timeline in his lifetime', Number(await year()) <= -44 && Number(await year()) >= -100, `year=${await year()}`)
  const c = await mapCenter()
  ok('caesar: map at Rome', Math.abs(c.lat - 41.9) < 0.6 && Math.abs(c.lng - 12.5) < 0.6, JSON.stringify(c))
}

// ── Journey 2: the most famous building ──────────────────────────────
{
  await page.goto(`${BASE}/?year=100&lat=48&lng=2&z=5`, { waitUntil: 'networkidle' }) // start far away (Paris)
  await page.waitForTimeout(4000)
  await searchAndPick('Colosseum')
  const txt = await bodyText()
  ok('colosseum: record opens', /largest amphitheatre|Vespasian/i.test(txt))
  const c = await mapCenter()
  ok('colosseum: map flew to Rome', Math.abs(c.lat - 41.9) < 0.6 && Math.abs(c.lng - 12.5) < 0.6, JSON.stringify(c))
}

// ── Journey 3: the city itself ───────────────────────────────────────
{
  await page.goto(`${BASE}/?year=100&lat=48&lng=2&z=5`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(4000)
  const rows = await searchAndPick('Rome')
  ok('rome: City ranks first', /^CITY\nRome/.test(rows[0] ?? ''), rows[0]?.replace(/\n/g, ' · '))
  const c = await mapCenter()
  ok('rome: map flew there', Math.abs(c.lat - 41.9) < 0.6 && Math.abs(c.lng - 12.5) < 0.6, JSON.stringify(c))
}

// ── Journey 4: stories open and start ────────────────────────────────
{
  await page.getByRole('button', { name: /stories/i }).first().click()
  await page.waitForTimeout(1000)
  const dialogText = await bodyText()
  ok('stories: catalog opens', /START/i.test(dialogText))
  await page.getByRole('button', { name: /^start$/i }).first().click()
  await page.waitForTimeout(3000)
  const hud = await bodyText()
  ok('stories: first story starts (HUD visible)', /next|step|1\s*\/|of \d/i.test(hud))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
}

// ── Journey 5: a battle popup reads like a title, not a stutter ──────
{
  await page.goto(`${BASE}/?year=-100&lat=44.8386&lng=-0.5783&z=7`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(5000)
  // enable battles via its search-toggle path: click the known marker spot
  await page.evaluate(() => localStorage.setItem('atlas-layers-v1', JSON.stringify(['showBattles'])))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(6000)
  await page.mouse.click(838, 461)
  await page.waitForTimeout(900)
  const title = await page.evaluate(
    () => document.querySelector('.map-tooltip-title')?.textContent ?? '',
  )
  ok('battle: popup opens on marker click', title.length > 0, title || 'no popup')
  ok('battle: title has no Battle-of-Battle stutter', !/Battle of (Battle|Siege|Sack|Fall)\b/.test(title), title)
}

await browser.close()
console.log(failures.length ? `\n${failures.length} FAILURE(S)` : '\nALL JOURNEYS PASS')
process.exit(failures.length ? 1 : 0)
