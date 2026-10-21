// Mixes the voice lines on the timeline (plus optional music) into public/audio-<lang>.mp3,
// loudness-normalised to -16 LUFS (streaming / social standard). Needs ffmpeg.
//   node scripts/mix.mjs [--lang en]
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, args, config, run, timeline } from './lib.mjs'

const a = args()
const cfg = config()
const { items, total } = timeline(cfg)
const music = cfg.music?.file ? path.resolve(ROOT, cfg.music.file) : null

for (const lang of a.lang ? [a.lang] : cfg.languages) {
  const inputs = []
  const filters = []
  items.forEach(({ scene, start }) => {
    const f = path.join(ROOT, 'public', 'voice', lang, `${scene.id}.mp3`)
    if (!fs.existsSync(f)) return
    const ms = Math.round((start + (scene.voiceDelay ?? cfg.voiceDelay ?? 0.4)) * 1000)
    inputs.push('-i', f)
    filters.push(`[${inputs.length / 2 - 1}:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay=${ms}|${ms}[v${filters.length}]`)
  })
  if (!filters.length) { console.log(`${lang}: no voice files in public/voice/${lang}, run scripts/voice.mjs first`); continue }
  const labels = filters.map((_, i) => `[v${i}]`).join('')
  let graph = `${filters.join(';')};${labels}amix=inputs=${filters.length}:normalize=0,apad,atrim=0:${total.toFixed(2)}[voice]`
  if (music && fs.existsSync(music)) {
    inputs.push('-stream_loop', '-1', '-i', music)
    const mi = inputs.filter((x) => x === '-i').length - 1
    graph += `;[${mi}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${cfg.music.volume ?? 0.15},atrim=0:${total.toFixed(2)},afade=t=out:st=${(total - 2).toFixed(2)}:d=2[music];[voice][music]amix=inputs=2:normalize=0[mix]`
  } else graph += ';[voice]anull[mix]'
  graph += ';[mix]loudnorm=I=-16:TP=-1.5:LRA=11[out]'
  const out = path.join(ROOT, 'public', `audio-${lang}.mp3`)
  run('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', graph, '-map', '[out]', '-ar', '48000', '-b:a', '192k', out])
  console.log(`${lang}: ${path.relative(ROOT, out)} (${total.toFixed(1)} s)`)
}
