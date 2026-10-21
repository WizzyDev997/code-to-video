// Checks every rendered video in out/: duration against the storyboard, loudness, and a contact
// sheet of 12 frames to look at (out/qa/<name>.png). Look at the sheets: a number cannot see a
// cropped headline or a caption sitting on top of the screenshot.
//   node scripts/qa.mjs
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, config, duration, mkdirp, run, timeline } from './lib.mjs'

const cfg = config()
const { total } = timeline(cfg)
const dir = path.join(ROOT, 'out')
mkdirp('out/qa')
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.mp4')) : []
if (!files.length) console.log('no video in out/, run scripts/render.mjs first')
let problems = 0
for (const f of files) {
  const file = path.join(dir, f)
  const d = duration(file)
  const notes = []
  if (Math.abs(d - total) > 0.5) { notes.push(`duration ${d.toFixed(1)} s, storyboard says ${total.toFixed(1)} s`); problems++ }
  const r = run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128', '-f', 'null', '-'], { quiet: true, allowFail: true })
  const m = (r.stderr || '').match(/Integrated loudness:\s*\n\s*I:\s*(-?[\d.]+) LUFS/)
  if (m) {
    const lufs = parseFloat(m[1])
    if (lufs < -19 || lufs > -13) { notes.push(`loudness ${lufs} LUFS (aim for -16)`); problems++ } else notes.push(`${lufs} LUFS`)
  } else notes.push('no audio')
  const sheet = path.join(dir, 'qa', f.replace(/\.mp4$/, '.png'))
  const fps = (12 / Math.max(d, 1)).toFixed(4)
  run('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-vf', `fps=${fps},scale=480:-2,tile=4x3:padding=6:color=white`, '-frames:v', '1', sheet], { allowFail: true })
  console.log(`${f}  ${d.toFixed(1)} s  ${notes.join(' · ')}\n  sheet: ${path.relative(ROOT, sheet)}`)
}
process.exit(problems ? 1 : 0)
