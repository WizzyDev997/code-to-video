// Static server for the demo app, no dependencies: node server.mjs [port]
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const dir = path.dirname(new URL(import.meta.url).pathname)
const port = +(process.argv[2] ?? 4173)
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }
http.createServer((req, res) => {
  const f = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname === '/' ? '/index.html' : new URL(req.url, 'http://x').pathname))
  if (!f.startsWith(dir) || !fs.existsSync(f)) { res.writeHead(404); return res.end('not found') }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] ?? 'application/octet-stream' })
  fs.createReadStream(f).pipe(res)
}).listen(port, () => console.log(`Crewboard demo on http://localhost:${port}`))
