// Shared helpers for the pipeline scripts. Node 20+, no dependencies.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
export const readJson = (f) => JSON.parse(fs.readFileSync(path.resolve(ROOT, f), 'utf8'))
export const config = () => readJson('video.config.json')

export const text = (v, lang) => (v === undefined ? '' : typeof v === 'string' ? v : v[lang] ?? v.en ?? Object.values(v)[0] ?? '')

// Scene start/end in seconds, with the same overlap rule as src/config.ts
export function timeline(cfg = config()) {
  const fps = cfg.fps
  const ov = Math.round(cfg.overlap * fps)
  let at = 0
  const items = cfg.scenes.map((s, i) => {
    const dur = Math.round(s.duration * fps)
    const from = at
    at += dur - (i < cfg.scenes.length - 1 ? ov : 0)
    return { scene: s, start: from / fps, end: (from + dur) / fps }
  })
  return { items, total: at / fps }
}

export function args(argv = process.argv.slice(2)) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) { out._.push(a); continue }
    const k = a.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) out[k] = true
    else { out[k] = next; i++ }
  }
  return out
}

export function run(cmd, list, opts = {}) {
  const r = spawnSync(cmd, list, { stdio: opts.quiet ? 'pipe' : 'inherit', encoding: 'utf8', cwd: opts.cwd ?? ROOT, env: { ...process.env, ...(opts.env ?? {}) } })
  if (r.status !== 0 && !opts.allowFail) {
    throw new Error(`${cmd} ${list.join(' ')} failed (${r.status})${r.stderr ? `\n${r.stderr.slice(-2000)}` : ''}`)
  }
  return r
}

export const has = (cmd) => spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { stdio: 'ignore' }).status === 0

export function duration(file) {
  const r = run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], { quiet: true, allowFail: true })
  return parseFloat(r.stdout) || 0
}

export const mkdirp = (d) => fs.mkdirSync(path.resolve(ROOT, d), { recursive: true })

// Reads KEY=value lines from .env (project folder, then its parents) without overriding the shell
export function loadEnv() {
  let dir = ROOT
  for (let i = 0; i < 4; i++) {
    const f = path.join(dir, '.env')
    if (fs.existsSync(f)) {
      for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
        if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
      }
    }
    dir = path.dirname(dir)
  }
}
