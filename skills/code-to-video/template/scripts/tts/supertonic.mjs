// Supertonic 3 text-to-speech on ONNX Runtime (CPU), for every language except English.
//
// Adapted from the Node.js example of https://github.com/supertone-inc/supertonic
//   Copyright (c) 2025 Supertone Inc. — MIT License (sample code).
// The model weights (downloaded on first use from supertone-oss-archive/supertonic-3) are under the
// OpenRAIL-M license: free to use, with use restrictions (no impersonation without consent, no
// undisclosed machine-generated content, no harassment or defamation). See the model card.
//
// Changes from the original: one module, seeded noise (a take is reproducible from its seed),
// typed arrays instead of nested arrays, no CLI.
import fs from 'node:fs'
import path from 'node:path'
import * as ort from 'onnxruntime-node'

export const SUPERTONIC_LANGS = ['ar', 'bg', 'cs', 'da', 'de', 'el', 'en', 'es', 'et', 'fi', 'fr', 'hi', 'hr', 'hu', 'id', 'it', 'ja', 'ko', 'lt', 'lv', 'nl', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sv', 'tr', 'uk', 'vi']
export const SUPERTONIC_VOICES = ['F1', 'F2', 'F3', 'F4', 'F5', 'M1', 'M2', 'M3', 'M4', 'M5']
export const SUPERTONIC_REPO = 'supertone-oss-archive/supertonic-3'
export const SUPERTONIC_REVISION = 'aafc6e32416a594460b32413efc49d7fe4ce6d46'
export const SUPERTONIC_FILES = [
  'onnx/duration_predictor.onnx', 'onnx/text_encoder.onnx', 'onnx/vector_estimator.onnx', 'onnx/vocoder.onnx',
  'onnx/tts.json', 'onnx/unicode_indexer.json', 'LICENSE',
  ...SUPERTONIC_VOICES.map((v) => `voice_styles/${v}.json`),
]

function preprocess(text, lang) {
  text = text.normalize('NFKD')
  text = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]+/gu, '')
  const swaps = { '–': '-', '‑': '-', '—': '-', _: ' ', '“': '"', '”': '"', '‘': "'", '’': "'", '´': "'", '`': "'", '[': ' ', ']': ' ', '|': ' ', '/': ' ', '#': ' ', '→': ' ', '←': ' ' }
  for (const [k, v] of Object.entries(swaps)) text = text.replaceAll(k, v)
  text = text.replace(/[♥☆♡©\\]/g, '').replaceAll('@', ' at ')
  text = text.replace(/ ([,.!?;:'])/g, '$1').replace(/""+/g, '"').replace(/''+/g, "'").replace(/\s+/g, ' ').trim()
  if (!/[.!?;:,'")\]}…。」』】〉》›»]$/.test(text)) text += '.'
  return `<${lang}>${text}</${lang}>`
}

function chunks(text, maxLen) {
  const out = []
  for (const para of text.trim().split(/\n\s*\n+/).filter((p) => p.trim())) {
    let cur = ''
    for (const s of para.trim().split(/(?<=[.!?])\s+/)) {
      if (cur.length + s.length + 1 <= maxLen) cur += (cur ? ' ' : '') + s
      else { if (cur) out.push(cur); cur = s }
    }
    if (cur) out.push(cur)
  }
  return out
}

// Small seeded PRNG (mulberry32) and Box-Muller for the initial noise
function gaussian(seed) {
  let a = seed >>> 0
  const u = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  return () => Math.sqrt(-2 * Math.log(Math.max(1e-10, u()))) * Math.cos(2 * Math.PI * u())
}

const f32 = (data, dims) => new ort.Tensor('float32', data instanceof Float32Array ? data : Float32Array.from(data), dims)
const i64 = (data, dims) => new ort.Tensor('int64', BigInt64Array.from(data.map((x) => BigInt(x))), dims)

export async function loadSupertonic(dir) {
  const onnx = path.join(dir, 'onnx')
  const cfg = JSON.parse(fs.readFileSync(path.join(onnx, 'tts.json'), 'utf8'))
  const indexer = JSON.parse(fs.readFileSync(path.join(onnx, 'unicode_indexer.json'), 'utf8'))
  const open = (f) => ort.InferenceSession.create(path.join(onnx, f))
  const [dp, enc, est, voc] = await Promise.all(['duration_predictor.onnx', 'text_encoder.onnx', 'vector_estimator.onnx', 'vocoder.onnx'].map(open))
  const sampleRate = cfg.ae.sample_rate
  const chunk = cfg.ae.base_chunk_size * cfg.ttl.chunk_compress_factor
  const ldim = cfg.ttl.latent_dim * cfg.ttl.chunk_compress_factor
  const styles = new Map()

  const style = (voice) => {
    if (!styles.has(voice)) {
      const file = path.join(dir, 'voice_styles', `${voice}.json`)
      if (!fs.existsSync(file)) throw new Error(`Supertonic voice ${voice} not found; voices: ${SUPERTONIC_VOICES.join(', ')}`)
      const s = JSON.parse(fs.readFileSync(file, 'utf8'))
      styles.set(voice, { ttl: f32(s.style_ttl.data.flat(Infinity), s.style_ttl.dims), dp: f32(s.style_dp.data.flat(Infinity), s.style_dp.dims) })
    }
    return styles.get(voice)
  }

  async function infer(text, lang, st, steps, speed, rnd) {
    const proc = preprocess(text, lang)
    const ids = Array.from(proc).map((c) => indexer[c.charCodeAt(0)] ?? 0)
    const n = ids.length
    const textIds = i64(ids, [1, n])
    const textMask = f32(new Float32Array(n).fill(1), [1, 1, n])
    const { duration } = await dp.run({ text_ids: textIds, style_dp: st.dp, text_mask: textMask })
    const dur = duration.data[0] / speed
    const { text_emb } = await enc.run({ text_ids: textIds, style_ttl: st.ttl, text_mask: textMask })
    const wavLen = Math.floor(dur * sampleRate)
    const len = Math.max(1, Math.floor((wavLen + chunk - 1) / chunk))
    let latent = new Float32Array(ldim * len)
    for (let i = 0; i < latent.length; i++) latent[i] = rnd()
    const latentMask = f32(new Float32Array(len).fill(1), [1, 1, len])
    const total = f32([steps], [1])
    for (let s = 0; s < steps; s++) {
      const r = await est.run({ noisy_latent: f32(latent, [1, ldim, len]), text_emb, style_ttl: st.ttl, text_mask: textMask, latent_mask: latentMask, total_step: total, current_step: f32([s], [1]) })
      latent = Float32Array.from(r.denoised_latent.data)
    }
    const { wav_tts } = await voc.run({ latent: f32(latent, [1, ldim, len]) })
    return wav_tts.data.subarray(0, wavLen)
  }

  // text -> mono Float32Array at sampleRate; long text is split into sentences with short pauses
  async function synth(text, { lang = 'fr', voice = 'F3', steps = 8, speed = 1.05, seed = 1 } = {}) {
    if (!SUPERTONIC_LANGS.includes(lang)) throw new Error(`Supertonic does not speak "${lang}". Languages: ${SUPERTONIC_LANGS.join(', ')}`)
    const st = style(voice)
    const rnd = gaussian(seed)
    const parts = []
    const gap = new Float32Array(Math.floor(0.3 * sampleRate))
    for (const [i, c] of chunks(text, lang === 'ko' || lang === 'ja' ? 120 : 300).entries()) {
      if (i) parts.push(gap)
      parts.push(await infer(c, lang, st, steps, speed, rnd))
    }
    const out = new Float32Array(parts.reduce((a, p) => a + p.length, 0))
    let o = 0
    for (const p of parts) { out.set(p, o); o += p.length }
    return out
  }

  return { sampleRate, synth }
}

// 16-bit PCM mono WAV
export function writeWav(file, samples, sampleRate) {
  const buf = Buffer.alloc(44 + samples.length * 2)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write('WAVE', 8)
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34)
  buf.write('data', 36); buf.writeUInt32LE(samples.length * 2, 40)
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2)
  fs.writeFileSync(file, buf)
}
