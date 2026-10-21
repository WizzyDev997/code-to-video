// Voice-over: one audio file per scene and language, from the `voice` line of each scene.
//   node scripts/voice.mjs [--lang en] [--provider deepgram] [--takes 3] [--only sceneId]
//
// Any text-to-speech works. Built in: deepgram, elevenlabs, openai, and "command" (any CLI: macOS
// `say`, piper, espeak, coqui...). Keys come from the environment or a .env file:
//   DEEPGRAM_API_KEY, ELEVENLABS_API_KEY, OPENAI_API_KEY
//
// Two lessons learned the hard way, both handled here:
//  - TTS voices mispronounce product names. `voice.respell` rewrites words for the voice only
//    ("nginx": "engine x"); captions keep the real spelling.
//  - Some voices are not deterministic and sometimes mangle a phrase. `--takes 3` generates three
//    takes per line and, when the `whisper` CLI is installed, keeps the one whose transcript is
//    closest to the script.
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, args, config, duration, has, loadEnv, mkdirp, run, text, timeline } from './lib.mjs'

loadEnv()
const a = args()
const cfg = config()
const vc = cfg.voice ?? {}
const langs = a.lang ? [a.lang] : cfg.languages
const takes = +(a.takes ?? vc.takes ?? 1)

const settings = (lang) => ({ ...vc, ...(vc.languages?.[lang] ?? {}) })

function respell(s, map = {}) {
  let out = s
  for (const [k, v] of Object.entries(map)) out = out.replace(new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), v)
  return out
}

async function save(res, file) {
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()))
}

const PROVIDERS = {
  async deepgram(s, line, file) {
    const key = process.env.DEEPGRAM_API_KEY
    if (!key) throw new Error('DEEPGRAM_API_KEY is not set')
    const model = s.deepgram?.model ?? 'aura-2-thalia-en'
    await save(await fetch(`https://api.deepgram.com/v1/speak?model=${encodeURIComponent(model)}&encoding=mp3`, {
      method: 'POST', headers: { Authorization: `Token ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: line }),
    }), file)
  },
  async elevenlabs(s, line, file) {
    const key = process.env.ELEVENLABS_API_KEY
    if (!key) throw new Error('ELEVENLABS_API_KEY is not set')
    const voice = s.elevenlabs?.voiceId
    if (!voice) throw new Error('voice.elevenlabs.voiceId is not set in video.config.json')
    await save(await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
      method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: line, model_id: s.elevenlabs?.modelId ?? 'eleven_multilingual_v2' }),
    }), file)
  },
  async openai(s, line, file) {
    const key = process.env.OPENAI_API_KEY
    if (!key) throw new Error('OPENAI_API_KEY is not set')
    await save(await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: s.openai?.model ?? 'gpt-4o-mini-tts', voice: s.openai?.voice ?? 'alloy', input: line, response_format: 'mp3' }),
    }), file)
  },
  // Any local or remote TTS: {text} and {out} are replaced; the command must write an audio file to {out}
  async command(s, line, file) {
    const tpl = s.command?.run
    if (!tpl) throw new Error('voice.command.run is not set, e.g. "say -o {out}.aiff \\"{text}\\" && ffmpeg -y -i {out}.aiff {out}"')
    const cmd = tpl.replaceAll('{text}', line.replace(/"/g, '\\"')).replaceAll('{out}', file)
    run('sh', ['-c', cmd])
  },
}

// Similarity of two sentences on their words (0..1), to pick the cleanest take
function similarity(x, y) {
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
  const A = norm(x), B = norm(y)
  const dp = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0))
  for (let i = 1; i <= A.length; i++) for (let j = 1; j <= B.length; j++) dp[i][j] = A[i - 1] === B[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
  return A.length ? dp[A.length][B.length] / Math.max(A.length, B.length) : 1
}

function transcribe(file, lang) {
  const dir = fs.mkdtempSync(path.join(path.dirname(file), '.wh-'))
  run('whisper', [file, '--model', vc.whisperModel ?? 'small', '--language', lang, '--output_format', 'txt', '--output_dir', dir], { quiet: true, allowFail: true })
  const txt = fs.readdirSync(dir).find((f) => f.endsWith('.txt'))
  const out = txt ? fs.readFileSync(path.join(dir, txt), 'utf8') : ''
  fs.rmSync(dir, { recursive: true, force: true })
  return out
}

const { items } = timeline(cfg)
for (const lang of langs) {
  const s = settings(lang)
  const provider = a.provider ?? s.provider ?? 'command'
  const fn = PROVIDERS[provider]
  if (!fn) throw new Error(`unknown provider ${provider}: ${Object.keys(PROVIDERS).join(', ')}`)
  const dir = path.join(ROOT, 'public', 'voice', lang)
  mkdirp(dir)
  for (const { scene, start, end } of items) {
    if (a.only && scene.id !== a.only) continue
    const script = text(scene.voice, lang)
    if (!script) continue
    const spoken = respell(script, s.respell)
    const files = []
    for (let k = 1; k <= takes; k++) {
      const f = path.join(dir, `${scene.id}${takes > 1 ? `-t${k}` : ''}.mp3`)
      await fn(s, spoken, f)
      files.push(f)
    }
    let best = files[0]
    if (files.length > 1 && has('whisper')) {
      const scored = files.map((f) => ({ f, score: similarity(script, transcribe(f, lang)) })).sort((x, y) => y.score - x.score)
      best = scored[0].f
      console.log(`  ${scene.id}: takes ${scored.map((x) => x.score.toFixed(2)).join(' / ')}`)
    }
    const final = path.join(dir, `${scene.id}.mp3`)
    if (best !== final) fs.copyFileSync(best, final)
    const len = duration(final)
    const room = end - start - (scene.voiceDelay ?? cfg.voiceDelay ?? 0.4)
    console.log(`${lang} ${scene.id}: ${len.toFixed(1)} s${len > room ? `  ⚠ longer than its scene (${room.toFixed(1)} s): shorten the line or the scene grows` : ''}`)
  }
}
console.log('next: node scripts/mix.mjs')
