import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://localhost:5173'
const OUT = process.env.OUT || '.'
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

// ---------- desktop ----------
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
const errs = []
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))

// 1. landing
await page.goto(BASE, { waitUntil: 'load' })
await page.waitForTimeout(3500)
const landing = await page.evaluate(() => document.body.innerText)
check('landing loads', landing.length > 200)
check('landing has stats', /\d[\d,.]+/.test(landing))
await page.screenshot({ path: `${OUT}/j1-landing.png` })

// 2. enter the map
await page.goto(BASE + '/?year=100&lat=41.9&lng=12.5&z=5', { waitUntil: 'load' })
await page.waitForTimeout(8000)
const mapTxt = await page.evaluate(() => document.body.innerText)
check('map shows Roman Empire label', /roman (empire|kingdom|republic)/i.test(mapTxt))
check('timeline visible', /founding|punic|empire/i.test(mapTxt))
await page.screenshot({ path: `${OUT}/j2-map.png` })

// 3. search: settlement
async function searchAndCount(q) {
  const input = page.locator('input[placeholder*="Search"]').first()
  await input.click()
  await input.fill('')
  await input.fill(q)
  await page.waitForTimeout(2200)
  return page.evaluate(() => document.body.innerText.slice(0, 900))
}
const s1 = await searchAndCount('Hierichous')
check('search finds Hierichous settlement', s1.includes('Hierichous'))
const s2 = await searchAndCount('Aqueduct of the Gier')
check('search finds Gier aqueduct', /Aqueduct of the Gier/.test(s2))
const gierCount = (s2.match(/Aqueduct of the Gier/g) || []).length
check('Gier appears once (deduped)', gierCount === 1, `count=${gierCount}`)
const s3 = await searchAndCount('Battle of Cannae')
check('search finds Cannae', /Cannae/.test(s3))
const s4 = await searchAndCount('Julius Caesar')
// several Romans legitimately carry 'Julius Caesar' (Augustus, Caligula,
// Nero Julius Caesar) — assert the dictator's PERSON row appears exactly once
check('search finds Caesar the person once',
  (s4.match(/PERSON\nJulius Caesar/g) || []).length === 1)

// 4. open the Gier detail panel
await searchAndCount('Aqueduct of the Gier')
// select + poll; retry once — the dropdown can close on flyTo under load
let panel = ''
for (let attempt = 0; attempt < 2 && !/historical record/i.test(panel); attempt++) {
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(1000)
    panel = await page.evaluate(() => document.body.innerText)
    if (/historical record/i.test(panel) && /Founded/.test(panel)) break
  }
  if (!/historical record/i.test(panel)) {
    const input = page.locator('input[placeholder*="Search"]').first()
    await input.click()
    await input.fill('')
    await input.fill('Aqueduct of the Gier')
    await page.waitForTimeout(2500)
  }
}
check('Gier panel opens', /historical record/i.test(panel))
check('Gier panel has no self-reference', !/Located in:\s*Aqueduct of the Gier/i.test(panel))
check('Gier panel shows Founded 100 AD', /Founded\s*\n?100 AD/.test(panel))
await page.screenshot({ path: `${OUT}/j3-panel.png` })

// 5. timeline: jump era via URL (slider drag is flaky headless)
await page.goto(BASE + '/?year=-200&lat=41.9&lng=12.5&z=5', { waitUntil: 'load' })
await page.waitForTimeout(3500)
const t1 = await page.evaluate(() => document.body.innerText)
check('timeline year -200 renders', /200 BC/.test(t1))
check('republic era shown', /republic|punic/i.test(t1))

// 6. story mode
await page.goto(BASE, { waitUntil: 'load' })
await page.waitForTimeout(2000)
const stories = page.locator('button, a').filter({ hasText: /stories/i }).first()
if (await stories.count()) {
  await stories.click()
  await page.waitForTimeout(5000)
  const st = await page.evaluate(() => document.body.innerText)
  check('stories open', st.length > 100)
  await page.screenshot({ path: `${OUT}/j4-stories.png` })
} else {
  check('stories open', false, 'no Stories button found')
}
check('desktop: zero page errors', errs.length === 0, errs.slice(0, 3).join(' | '))
await page.close()

// ---------- mobile ----------
const mob = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
})
const merrs = []
mob.on('pageerror', (e) => merrs.push(String(e).slice(0, 200)))
await mob.goto(BASE + '/?year=100&lat=41.9&lng=12.5&z=5', { waitUntil: 'load' })
await mob.waitForTimeout(5000)
const hscroll = await mob.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
)
check('mobile: no horizontal overflow', !hscroll)
const mtxt = await mob.evaluate(() => document.body.innerText)
check('mobile: map renders', /roman/i.test(mtxt))
await mob.screenshot({ path: `${OUT}/j5-mobile.png` })
check('mobile: zero page errors', merrs.length === 0, merrs.slice(0, 3).join(' | '))
await mob.close()

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
