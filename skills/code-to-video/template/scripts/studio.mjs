// Preview player: builds the page and serves it with play, scrub, format and language controls.
//   node scripts/studio.mjs [--port 3000]
// Rebuild by restarting after you edit video.config.json or a scene.
import { args } from './lib.mjs'
import { buildPage, serve } from './build.mjs'

const a = args()
const dist = await buildPage()
const server = await serve(dist, +(a.port ?? 3000))
console.log(`preview: http://localhost:${server.address().port}/?player=1`)
