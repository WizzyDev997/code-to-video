// Renders the video: Playwright sets each frame and photographs the stage, several pages in parallel,
// then ffmpeg encodes the frames with the soundtrack. Preview first (half size), final once approved.
//   node scripts/render.mjs --preview [--format 16:9] [--lang en]
//   node scripts/render.mjs [--format all] [--lang all] [--workers 6]
//   node scripts/render.mjs --stills 90,300 --format 9:16       (single frames, to check a layout)
// Set CHROMIUM_PATH to a Chrome / chrome-headless-shell if Playwright's own browser is not installed.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'
import { ROOT, args, config, mkdirp, run } from './lib.mjs'
import { buildPage, serve } from './build.mjs'

const a = args()
const cfg = config()
const IDS = { '16:9': '16x9', '9:16': '9x16', '1:1': '1x1' }
const formats = !a.format || a.format === 'all' ? cfg.formats : [a.format]
const langs = !a.lang || a.lang === 'all' ? cfg.languages : [a.lang]
const workers = +(a.workers ?? Math.max(2, Math.min(6, os.cpus().length - 2)))
const scale = a.preview ? 0.5 : 1
const slug = (cfg.title || 'video').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const dist = await buildPage({ quiet: true })
const server = await serve(dist)
const port = server.address().port
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
mkdirp('out')

async function open(fmt, lang) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1920 }, deviceScaleFactor: scale })
  page.on('pageerror', (e) => console.error('page error:', String(e)))
  await page.goto(`http://localhost:${port}/?format=${IDS[fmt]}&lang=${lang}`)
  await page.waitForFunction(() => typeof window.__setFrame === 'function')
  return page
}
async function shoot(page, f, file) {
  await page.evaluate((n) => window.__setFrame(n), f)
  await page.locator('#stage').screenshot({ path: file, type: file.endsWith('.jpg') ? 'jpeg' : 'png', ...(file.endsWith('.jpg') ? { quality: 95 } : {}) })
}

for (const fmt of formats) {
  for (const lang of langs) {
    const t0 = Date.now()
    const first = await open(fmt, lang)
    const total = await first.evaluate(() => window.__TOTAL__)
    if (a.stills) {
      for (const f of String(a.stills).split(',').map(Number)) {
        const file = path.join(ROOT, 'out', `still-${IDS[fmt]}-${lang}-${f}.png`)
        await shoot(first, f, file)
        console.log('still', path.relative(ROOT, file))
      }
      await first.close()
      continue
    }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'c2v-frames-'))
    const pages = [first, ...(await Promise.all(Array.from({ length: workers - 1 }, () => open(fmt, lang))))]
    let done = 0
    console.log(`render ${IDS[fmt]} ${lang}: ${total} frames on ${pages.length} pages`)
    await Promise.all(pages.map(async (page, w) => {
      for (let f = w; f < total; f += pages.length) {
        await shoot(page, f, path.join(tmp, `${String(f).padStart(5, '0')}.png`))
        if (++done % 300 === 0) console.log(`  ${done}/${total} · ${((Date.now() - t0) / 1000).toFixed(0)} s`)
      }
    }))
    await Promise.all(pages.map((p) => p.close()))
    const out = path.join(ROOT, 'out', `${slug}-${IDS[fmt]}-${lang}${a.preview ? '-preview' : ''}.mp4`)
    const audio = path.join(ROOT, 'public', `audio-${lang}.mp3`)
    // the soundtrack is padded with silence, so the storyboard (not the audio) sets the length
    const sound = fs.existsSync(audio) ? { inputs: ['-i', audio], codec: ['-af', 'apad', '-c:a', 'aac', '-b:a', '192k', '-shortest'] } : { inputs: [], codec: [] }
    run('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(cfg.fps), '-i', path.join(tmp, '%05d.png'), ...sound.inputs,
      '-c:v', 'libx264', '-crf', a.preview ? '26' : '16', '-preset', a.preview ? 'veryfast' : 'medium', '-pix_fmt', 'yuv420p',
      ...sound.codec, '-movflags', '+faststart', out])
    fs.rmSync(tmp, { recursive: true, force: true })
    console.log(`  -> ${path.relative(ROOT, out)} in ${((Date.now() - t0) / 1000).toFixed(0)} s`)
  }
}
await browser.close()
server.close()
if (!a.stills) console.log('next: node scripts/qa.mjs')
