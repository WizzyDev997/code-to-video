// Captures real screens and short recordings of the running product with Playwright.
// Screens: public/captures/<name>.png. Recordings: public/captures/<name>/ (one jpg per frame).
//   node scripts/capture.mjs [capture.json]
// Optional: CHROMIUM_PATH=/path/to/chrome when Playwright's own browser is not installed.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'
import { ROOT, args, has, mkdirp, readJson, run } from './lib.mjs'

const a = args()
const cfg = readJson(a._[0] ?? 'capture.json')
const out = path.resolve(ROOT, cfg.outDir ?? 'public/captures')
mkdirp(out)
const viewport = cfg.viewport ?? { width: 1600, height: 1000 }
const scale = cfg.deviceScaleFactor ?? 1.25

// 1. start the app when asked, and wait until it answers
let server = null
if (cfg.start) {
  server = spawn(cfg.start.command, { shell: true, cwd: path.resolve(ROOT, cfg.start.cwd ?? '.'), stdio: 'ignore', detached: true })
  const deadline = Date.now() + (cfg.start.timeoutMs ?? 60000)
  for (;;) {
    try { const r = await fetch(cfg.start.readyUrl ?? cfg.baseUrl); if (r.ok) break } catch { /* not up yet */ }
    if (Date.now() > deadline) throw new Error(`the app did not answer on ${cfg.start.readyUrl ?? cfg.baseUrl}`)
    await new Promise((r) => setTimeout(r, 500))
  }
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const errors = []

async function prepare(page) {
  page.on('pageerror', (e) => errors.push(String(e)))
  if (cfg.localStorage) {
    await page.goto(cfg.baseUrl)
    await page.evaluate((kv) => { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)) }, cfg.localStorage)
  }
}

// Steps: {goto}, {click}, {fill: [sel, text]}, {type: [sel, text, delayMs]}, {press}, {hover},
// {wait: ms}, {waitFor: sel}, {scroll: px}, {upload: [sel, file]}
async function act(page, steps = []) {
  for (const s of steps) {
    if (s.goto !== undefined) await page.goto(new URL(s.goto, cfg.baseUrl).href)
    else if (s.click) await page.locator(s.click).first().click()
    else if (s.fill) await page.locator(s.fill[0]).first().fill(s.fill[1])
    else if (s.type) await page.locator(s.type[0]).first().pressSequentially(s.type[1], { delay: s.type[2] ?? 60 })
    else if (s.press) await page.keyboard.press(s.press)
    else if (s.hover) await page.locator(s.hover).first().hover()
    else if (s.wait) await page.waitForTimeout(s.wait)
    else if (s.waitFor) await page.locator(s.waitFor).first().waitFor()
    else if (s.scroll) await page.mouse.wheel(0, s.scroll)
    else if (s.upload) await page.locator(s.upload[0]).first().setInputFiles(path.resolve(ROOT, s.upload[1]))
  }
}

// 2. screenshots
for (const shot of cfg.shots ?? []) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, locale: cfg.locale })
  const page = await ctx.newPage()
  await prepare(page)
  await page.goto(new URL(shot.path ?? '/', cfg.baseUrl).href)
  await page.waitForTimeout(shot.settleMs ?? cfg.settleMs ?? 800)
  await act(page, shot.actions)
  const file = path.join(out, `${shot.name}.png`)
  await page.screenshot({ path: file, fullPage: !!shot.fullPage })
  console.log('shot ', path.relative(ROOT, file))
  await ctx.close()
}

// 3. recordings (the browser records the whole context; converted to mp4 when ffmpeg is there)
for (const clip of cfg.clips ?? []) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'c2v-'))
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: cfg.locale, recordVideo: { dir: tmp, size: viewport } })
  const page = await ctx.newPage()
  await prepare(page)
  await page.goto(new URL(clip.path ?? '/', cfg.baseUrl).href)
  await page.waitForTimeout(clip.settleMs ?? 600)
  await act(page, clip.actions)
  await page.waitForTimeout(clip.tailMs ?? 800)
  const video = page.video()
  await ctx.close()
  const webm = await video.path()
  // the recording becomes a folder of frames (public/captures/<name>/00001.jpg ...): the video page
  // shows one image per frame, exact and with no video codec needed in the headless browser
  const dir = path.join(out, clip.name)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  if (!has('ffmpeg')) throw new Error('ffmpeg is needed to turn recordings into frames')
  run('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-vf', `fps=${clip.fps ?? 30}`, '-q:v', '3', path.join(dir, '%05d.jpg')])
  console.log('clip ', path.relative(ROOT, dir), `(${fs.readdirSync(dir).length} frames)`)
}

await browser.close()
if (server) { try { process.kill(-server.pid) } catch { /* already gone */ } }
console.log(errors.length ? `page errors:\n  ${errors.slice(0, 8).join('\n  ')}` : 'no page errors')
