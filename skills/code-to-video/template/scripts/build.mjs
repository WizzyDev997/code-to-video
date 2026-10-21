// Bundles the video page into dist/ (esbuild): the scenes, the frame engine, the fonts and public/.
//   node scripts/build.mjs
import fs from 'node:fs'
import path from 'node:path'
import { build } from 'esbuild'
import { ROOT } from './lib.mjs'

export async function buildPage({ quiet = false } = {}) {
  const dist = path.join(ROOT, 'dist')
  fs.rmSync(dist, { recursive: true, force: true })
  fs.mkdirSync(dist, { recursive: true })
  await build({
    entryPoints: [path.join(ROOT, 'src/main.tsx')],
    bundle: true,
    outdir: dist,
    entryNames: 'bundle',
    format: 'esm',
    jsx: 'automatic',
    minify: true,
    loader: { '.woff2': 'file', '.woff': 'file' },
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'warning',
  })
  // everything in public/ is served as is; the list lets scenes know which files exist
  const files = []
  const copy = (from, rel = '') => {
    if (!fs.existsSync(from)) return
    for (const f of fs.readdirSync(from)) {
      if (f.startsWith('.')) continue
      const src = path.join(from, f), r = path.join(rel, f)
      if (fs.statSync(src).isDirectory()) { fs.mkdirSync(path.join(dist, r), { recursive: true }); copy(src, r) }
      else { fs.copyFileSync(src, path.join(dist, r)); files.push(r.split(path.sep).join('/')) }
    }
  }
  copy(path.join(ROOT, 'public'))
  fs.writeFileSync(path.join(dist, 'index.html'), `<!doctype html>
<html><head><meta charset="utf-8"><title>code-to-video</title>
<link rel="stylesheet" href="/bundle.css">
<style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0;padding:0;overflow:hidden;background:#000}</style>
<script>window.__STATIC_FILES__=${JSON.stringify(files)}</script>
</head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>
`)
  if (!quiet) console.log(`built dist/ (${files.length} static files)`)
  return dist
}

// A small static server for dist/ (fonts and images load as on the web)
export async function serve(dist, port = 0) {
  const http = await import('node:http')
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp3': 'audio/mpeg' }
  const server = http.createServer((req, res) => {
    const f = path.join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname))
    const file = f.startsWith(dist) && fs.existsSync(f) && fs.statSync(f).isFile() ? f : path.join(dist, 'index.html')
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
  await new Promise((r) => server.listen(port, r))
  return server
}

if (import.meta.url === `file://${process.argv[1]}`) await buildPage()
