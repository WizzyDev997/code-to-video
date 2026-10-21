// Downloads the open-source voice models into .cache/voice-models/ (once; then everything runs offline).
//   node scripts/fetch-voice-model.mjs [kokoro|supertonic|all]
// No account, no key: both repositories are public on Hugging Face.
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, args } from './lib.mjs'
import { SUPERTONIC_FILES, SUPERTONIC_REPO, SUPERTONIC_REVISION } from './tts/supertonic.mjs'

export const MODELS_DIR = path.join(ROOT, '.cache', 'voice-models')

async function download(url, file) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download failed (${res.status}): ${url}`)
  const total = +(res.headers.get('content-length') ?? 0)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.part`
  const out = fs.createWriteStream(tmp)
  let got = 0, shown = 0
  for await (const piece of res.body) {
    out.write(piece)
    got += piece.length
    if (total > 20e6 && got - shown > total / 10) { shown = got; process.stdout.write(`  ${path.basename(file)} ${Math.round((got / total) * 100)} %\r`) }
  }
  await new Promise((r) => out.end(r))
  fs.renameSync(tmp, file)
}

// Supertonic 3: ~400 MB the first time
export async function ensureSupertonic() {
  const dir = path.join(MODELS_DIR, 'supertonic-3')
  const missing = SUPERTONIC_FILES.filter((f) => !fs.existsSync(path.join(dir, f)))
  if (missing.length) {
    console.log(`downloading Supertonic 3 (about 400 MB, once) into ${path.relative(ROOT, dir)}/`)
    for (const f of missing) await download(`https://huggingface.co/${SUPERTONIC_REPO}/resolve/${SUPERTONIC_REVISION}/${f}`, path.join(dir, f))
    console.log('Supertonic 3 ready.                ')
  }
  return dir
}

// Kokoro: kokoro-js downloads it itself (about 90 MB in q8); we only point its cache here
export async function ensureKokoro(dtype = 'q8') {
  const { env } = await import('@huggingface/transformers')
  env.cacheDir = path.join(MODELS_DIR, 'kokoro')
  const { KokoroTTS } = await import('kokoro-js')
  const first = !fs.existsSync(env.cacheDir)
  if (first) console.log(`downloading Kokoro-82M (${dtype}, about ${dtype === 'fp32' ? 330 : 90} MB, once) into ${path.relative(ROOT, env.cacheDir)}/`)
  return KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype, device: 'cpu' })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const which = args()._[0] ?? 'all'
  if (which === 'kokoro' || which === 'all') await ensureKokoro()
  if (which === 'supertonic' || which === 'all') await ensureSupertonic()
  console.log('voice models ready in', path.relative(ROOT, MODELS_DIR))
}
