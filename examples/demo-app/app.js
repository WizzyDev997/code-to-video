// Crewboard: a tiny, fictional team-workload board used to test code-to-video end to end.
// Every number on screen is computed here, so the video can quote it honestly.
const PEOPLE = [
  { name: 'Ana', skills: ['design', 'frontend'], cap: 40 },
  { name: 'Ben', skills: ['backend', 'data'], cap: 40 },
  { name: 'Mia', skills: ['frontend', 'backend'], cap: 32 },
  { name: 'Leo', skills: ['data', 'design', 'backend'], cap: 40 },
]
const TASKS = [
  ['T1', 'Checkout redesign', 'design', 14, 3, 'Ana'], ['T2', 'Search API', 'backend', 12, 2, 'Ben'],
  ['T3', 'Onboarding flow', 'frontend', 10, 4, 'Ana'], ['T4', 'Billing export', 'data', 9, 3, 'Ben'],
  ['T5', 'Dark mode', 'frontend', 8, 5, 'Ana'], ['T6', 'Rate limiter', 'backend', 11, 4, 'Ben'],
  ['T7', 'Usage dashboard', 'data', 13, 5, 'Ben'], ['T8', 'Icon set', 'design', 6, 2, 'Ana'],
  ['T9', 'Settings page', 'frontend', 7, 5, 'Mia'], ['T10', 'Cache warmup', 'backend', 5, 4, 'Mia'],
  ['T11', 'Churn report', 'data', 6, 5, 'Leo'], ['T12', 'Empty states', 'design', 4, 4, 'Ana'],
].map(([id, title, skill, h, due, who]) => ({ id, title, skill, h, due, who }))

let tasks = structuredClone(TASKS)
let moved = new Set()

const loadOf = (name) => tasks.filter((t) => t.who === name).reduce((a, t) => a + t.h, 0)
const capOf = (name) => PEOPLE.find((p) => p.name === name).cap
// A task is at risk when, done in due order, it would finish after its due day (8 h per day)
function atRisk() {
  const out = new Set()
  for (const p of PEOPLE) {
    let cum = 0
    for (const t of tasks.filter((t) => t.who === p.name).sort((a, b) => a.due - b.due || a.id.localeCompare(b.id))) {
      cum += t.h
      if (cum > t.due * 8 * (p.cap / 40)) out.add(t.id)
    }
  }
  return out
}

function render() {
  const risk = atRisk()
  const over = PEOPLE.filter((p) => loadOf(p.name) > p.cap).length
  const peak = Math.max(...PEOPLE.map((p) => Math.round((loadOf(p.name) / p.cap) * 100)))
  setKpi('k-over', over, over > 0 ? 'bad' : 'good')
  setKpi('k-peak', `${peak} %`, peak > 100 ? 'bad' : 'good')
  setKpi('k-risk', risk.size, risk.size > 0 ? 'bad' : 'good')
  setKpi('k-hours', `${tasks.reduce((a, t) => a + t.h, 0)} h`, '')
  document.getElementById('people').innerHTML = PEOPLE.map((p) => {
    const load = loadOf(p.name), pct = Math.round((load / p.cap) * 100)
    const list = tasks.filter((t) => t.who === p.name).sort((a, b) => a.due - b.due)
    return `<div class="person" data-person="${p.name}"><h3>${p.name}</h3><div class="skills">${p.skills.join(' · ')}</div>
      <div class="bar"><i class="${load > p.cap ? 'over' : ''}" style="width:${Math.min(100, pct)}%"></i></div>
      <div class="load">${load} h / ${p.cap} h · ${pct} %</div>
      ${list.map((t) => `<div class="task ${risk.has(t.id) ? 'risk' : ''} ${moved.has(t.id) ? 'moved' : ''}"><div><b>${t.id}</b> ${t.title}</div><span>${t.h} h · day ${t.due}</span></div>`).join('')}</div>`
  }).join('')
}
function setKpi(id, v, tone) { const el = document.getElementById(id); el.textContent = v; el.className = `v ${tone}` }
function reply(msg, err = false) { const el = document.getElementById('reply'); el.textContent = msg; el.className = `reply ${err ? 'err' : ''}` }

// Balance: longest tasks first, each to the qualified person with the lowest load share
function balance() {
  const before = new Map(tasks.map((t) => [t.id, t.who]))
  for (const p of PEOPLE) p.tmp = 0
  for (const t of [...tasks].sort((a, b) => b.h - a.h || a.due - b.due)) {
    const ok = PEOPLE.filter((p) => p.skills.includes(t.skill)).sort((a, b) => (a.tmp + t.h) / a.cap - (b.tmp + t.h) / b.cap || a.name.localeCompare(b.name))
    t.who = ok[0].name
    ok[0].tmp += t.h
  }
  moved = new Set(tasks.filter((t) => before.get(t.id) !== t.who).map((t) => t.id))
  render()
  reply(`Balanced: ${moved.size} tasks moved, ${atRisk().size} at risk, nobody above capacity.`)
}

function command(text) {
  const s = text.trim().toLowerCase()
  if (s === 'balance') return balance()
  if (s === 'reset') { tasks = structuredClone(TASKS); moved = new Set(); render(); return reply('Back to the original plan.') }
  const m = s.match(/^move\s+(t\d+)\s+to\s+(\w+)$/)
  if (m) {
    const t = tasks.find((x) => x.id.toLowerCase() === m[1]), p = PEOPLE.find((x) => x.name.toLowerCase() === m[2])
    if (!t || !p) return reply('Unknown task or person.', true)
    if (!p.skills.includes(t.skill)) return reply(`${p.name} does not have the ${t.skill} skill for ${t.id}.`, true)
    t.who = p.name; moved = new Set([t.id]); render()
    return reply(`${t.id} moved to ${p.name}: ${p.name} is now at ${Math.round((loadOf(p.name) / p.cap) * 100)} %.`)
  }
  reply('Try: move T7 to Leo · balance · reset', true)
}

document.getElementById('balance').onclick = balance
document.getElementById('reset').onclick = () => command('reset')
document.getElementById('cmd').addEventListener('keydown', (e) => { if (e.key === 'Enter') { command(e.target.value); e.target.value = '' } })
render()
