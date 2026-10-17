#!/usr/bin/env node
/**
 * First-load weight at the default view: requests + bytes, decoded and
 * transferred, for a fresh visitor (no cache, no localStorage).
 *
 * Usage: node e2e/measure-first-load.mjs [baseUrl] [--list]
 *   no baseUrl: serves ./dist gzip-compressed at /Ancient-Rome/ (what
 *   GitHub Pages does), so transferred bytes are comparable to live.
 *   --list prints every app request, largest first.
 * Waits for 'load', then for the network to stay quiet (app requests) for
 * 5 s or 60 s total, so background tiers that stream in after paint count.
 * Map tiles are reported separately: they depend on the tile CDN, not us.
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import path from 'node:path'
import { chromium } from 'playwright'

const args = process.argv.slice(2)
const list = args.includes('--list')
let base = args.find((a) => !a.startsWith('--'))
let server

if (!base) {
  const root = path.resolve('dist')
  const types = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
  }
  const gz = new Map()
  server = createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    p = p.replace(/^\/Ancient-Rome/, '') || '/'
    let file = path.join(root, p)
    try {
      if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html')
    } catch {
      file = path.join(root, 'index.html')
    }
    const ext = path.extname(file)
    const body = await readFile(file)
    res.setHeader('Content-Type', types[ext] ?? 'application/octet-stream')
    if (/\.(html|js|css|json|svg)$/.test(ext)) {
      if (!gz.has(file)) gz.set(file, gzipSync(body, { level: 6 }))
      res.setHeader('Content-Encoding', 'gzip')
      res.end(gz.get(file))
    } else res.end(body)
  })
  await new Promise((r) => server.listen(0, r))
  base = `http://localhost:${server.address().port}/Ancient-Rome/`
}

// system Chrome if playwright's own browser isn't downloaded
const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }))
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const cdp = await ctx.newCDPSession(page)
await cdp.send('Network.enable')
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })

const reqs = new Map()
let lastApp = Date.now()
const isTile = (url) => !url.startsWith(new URL(base).origin)
cdp.on('Network.responseReceived', (e) => {
  reqs.set(e.requestId, { url: e.response.url, decoded: 0, transferred: 0 })
})
cdp.on('Network.dataReceived', (e) => {
  const r = reqs.get(e.requestId)
  if (r) r.decoded += e.dataLength
})
cdp.on('Network.loadingFinished', (e) => {
  const r = reqs.get(e.requestId)
  if (!r) return
  r.transferred = e.encodedDataLength
  r.done = true
  if (!isTile(r.url)) lastApp = Date.now()
})

const t0 = Date.now()
await page.goto(base, { waitUntil: 'load', timeout: 90000 })
while (Date.now() - lastApp < 5000 && Date.now() - t0 < 60000) {
  await page.waitForTimeout(500)
}

const done = [...reqs.values()].filter((r) => r.done)
const sum = (rs, k) => rs.reduce((s, r) => s + r[k], 0)
const mb = (n) => `${(n / 1e6).toFixed(2)} MB`
const app = done.filter((r) => !isTile(r.url))
const tiles = done.filter((r) => isTile(r.url))
console.log(`base: ${base}`)
console.log(
  `app:   ${app.length} requests, ${mb(sum(app, 'decoded'))} decoded, ${mb(sum(app, 'transferred'))} transferred`,
)
console.log(
  `other: ${tiles.length} requests, ${mb(sum(tiles, 'decoded'))} decoded, ${mb(sum(tiles, 'transferred'))} transferred (tiles/CDN)`,
)
if (list) {
  for (const r of app.sort((a, b) => b.decoded - a.decoded)) {
    const name = new URL(r.url).pathname.split('/').pop()
    console.log(`  ${mb(r.decoded).padStart(9)} ${mb(r.transferred).padStart(9)}  ${name}`)
  }
}
await browser.close()
server?.close()
