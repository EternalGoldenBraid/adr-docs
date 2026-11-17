<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

// Live team graph with three views of the roster (Topic, Machine, Command), nodes coloured by mesh status.
// Needs the preview's comment bridge; the built site shows a note instead.
const VIEWS = [['topic', 'Topic'], ['machine', 'Machine'], ['command', 'Command']]
const model = ref({ nodes: [], boxes: [], links: [], pulses: [] })
const note = ref('Loading team…')
const view = ref((typeof localStorage !== 'undefined' && localStorage.getItem('team-graph-view')) || 'topic')
let timer = null
const rows = ref([])
let members = []
let edges = []

// Indicators shared with the desktop mesh panel: blue working, pink waiting, yellow asking, green idle, hollow ring = active (state unknown).
const COLOURS = { working: '#6fb7e8', waiting: '#f38ba8', asking: '#ffd500', idle: '#9ccc65', active: '#9399b2', offline: '#9399b2', human: '#e6edf7' }
const state = m => {
  if (!m.session) return 'human'
  if (m.status !== 'active' || (m.lastSeen && Date.now() - Date.parse(m.lastSeen) > 30 * 60000)) return 'offline'
  if (['working', 'waiting', 'asking', 'idle'].includes(m.activity)) return m.activity
  const line = m.statusLine?.state
  return line === 'running' ? 'working' : line === 'waiting' || line === 'blocked' ? 'waiting' : line === 'idle' ? 'idle' : 'active'
}
const ago = iso => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 1 ? 'now' : m < 60 ? m + 'm' : Math.round(m / 60) + 'h' }
const rowOf = m => {
  const l = m.statusLine, st = state(m)
  return { key: id(m), name: m.name, st, status: st === 'offline' ? m.status : st, doing: l ? `${l.ticket ? l.ticket + ' · ' : ''}${l.state} · ${l.doing}${l.next ? ' → ' + l.next : ''} (${ago(l.at)})` : '—', machine: m.machine || '—' }
}
// The live table replaces the hand-written roster table on the page; the markdown source stays for the roster parser but is hidden.
const hideSource = on => {
  for (const t of document.querySelectorAll('.vp-doc table:not(.team-live)')) {
    if ([...t.querySelectorAll('th')].some(th => th.textContent.trim() === 'Session')) t.style.display = on ? 'none' : ''
  }
}
const hollow = s => s === 'active' || s === 'offline'
const clip = (text, n) => text.length > n ? text.slice(0, n - 1) + '…' : text
const slug = text => text.toLowerCase().replace(/[^a-z\d]+/g, '-')
const id = m => m.session || 'h:' + m.slug

// Positions in abstract grid units, then fitted to the SVG viewBox.
function layout() {
  const mode = view.value
  const groupOf = m => mode === 'topic' ? m.topic : mode === 'machine' ? m.machine : ''
  const keys = [...new Set(members.map(m => groupOf(m) || ''))]
  const rowsIn = new Map(), pos = new Map(), groups = [], lines = []
  const ordered = mode === 'machine' ? [...members].sort((a, b) => (a.topic || '').localeCompare(b.topic || '')) : members
  if (mode === 'command') {
    const byName = new Map(members.map(m => [slug(m.name), m]))
    const kids = new Map(members.map(m => [id(m), []]))
    const top = []
    for (const m of members) {
      const boss = m.reportsTo && byName.get(slug(m.reportsTo))
      if (boss && boss !== m) { kids.get(id(boss)).push(m); lines.push([id(boss), id(m)]) } else top.push(m)
    }
    const place = (m, left, depth, trail) => {
      const children = trail.has(id(m)) ? [] : kids.get(id(m))
      let width = 0
      for (const child of children) width += place(child, left + width, depth + 1, new Set([...trail, id(m)]))
      width = Math.max(width, 1)
      pos.set(id(m), { x: (left + width / 2) * 200, y: depth * 150 })
      return width
    }
    let left = 0
    for (const m of top) left += place(m, left, 0, new Set())
  } else {
    for (const m of ordered) {
      const column = keys.indexOf(groupOf(m) || ''), row = rowsIn.get(column) ?? 0
      rowsIn.set(column, row + 1)
      pos.set(id(m), mode === 'topic' ? { x: (column % 4) * 280 + (row % 2) * 120, y: Math.floor(column / 4) * 200 + Math.floor(row / 2) * 110 } : { x: column * 300, y: row * 130 })
    }
    const boxes = new Map()
    const add = (key, label, m, inner) => { const b = boxes.get(key) ?? { label, inner, ids: [] }; b.ids.push(id(m)); boxes.set(key, b) }
    for (const m of ordered) {
      if (mode === 'topic' && m.topic) add('t:' + m.topic, m.topic, m, false)
      if (mode === 'machine' && m.machine) { add('m:' + m.machine, m.machine, m, false); if (m.topic) add('m:' + m.machine + ':' + m.topic, m.topic, m, true) }
    }
    for (const b of boxes.values()) groups.push(b)
  }
  const pts = [...pos.values()]
  const minX = Math.min(...pts.map(q => q.x)), maxX = Math.max(...pts.map(q => q.x))
  const minY = Math.min(...pts.map(q => q.y)), maxY = Math.max(...pts.map(q => q.y))
  const W = 900, H = 460, pad = 70
  const scale = Math.min(1.6, (W - 2 * pad) / Math.max(1, maxX - minX), (H - 2 * (pad + 30)) / Math.max(1, maxY - minY))
  const fit = q => ({ x: W / 2 + (q.x - (minX + maxX) / 2) * scale, y: H / 2 + (q.y - (minY + maxY) / 2) * scale })
  const nodes = members.map((m, i) => {
    const q = fit(pos.get(id(m))), st = state(m), doing = m.statusLine?.doing || m.work
    return { key: id(m), name: m.name, doing: doing ? clip(doing, 34) : '', st, colour: COLOURS[st], solid: !hollow(st) && st !== 'human', human: st === 'human', x: q.x, y: q.y, i }
  })
  const at = new Map(nodes.map(n => [n.key, n]))
  const boxes = groups.map(g => {
    const q = g.ids.map(k => at.get(k))
    const x1 = Math.min(...q.map(n => n.x)) - (g.inner ? 55 : 75), x2 = Math.max(...q.map(n => n.x)) + (g.inner ? 55 : 75)
    const y1 = Math.min(...q.map(n => n.y)) - (g.inner ? 48 : 80), y2 = Math.max(...q.map(n => n.y)) + (g.inner ? 56 : 70)
    return { label: g.label, x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
  })
  const links = lines.map(([a, b]) => ({ a: at.get(a), b: at.get(b) }))
  const pulses = edges.filter(e => at.has(e.from) && at.has(e.to)).map((e, i) => ({ key: e.from + '>' + e.to, a: at.get(e.from), b: at.get(e.to), n: e.count, delay: (i * 1.3) % 5 }))
  return { nodes, boxes, links, pulses }
}

function pick(value) {
  view.value = value
  localStorage.setItem('team-graph-view', value)
  model.value = layout()
}

const machines = ref([])
function machineOf(m) {
  if (m.error) return { name: m.name, error: m.error }
  const peak = Math.max(m.nproc, ...m.history), y = v => (22 - v / peak * 20).toFixed(1)
  const points = m.history.map((v, i) => `${(i / Math.max(1, m.history.length - 1) * 100).toFixed(1)},${y(v)}`).join(' ')
  const gpu = m.gpus.length ? ` · GPU util ${m.gpus.map(g => g.util + ' %').join(' / ')}` : ''
  const heat = pct => pct < 50 ? '#9ccc65' : pct < 80 ? '#ffd500' : '#f38ba8'
  const cores = (m.cores ?? []).map((pct, i) => ({ i, pct, color: heat(pct) }))
  const gpus = m.gpus.map((g, i) => ({
    label: `GPU ${i}${g.name ? ' · ' + g.name.replace(/^NVIDIA (GeForce )?/, '') : ''}`,
    util: g.util, utilColor: heat(g.util),
    vramPct: g.mem_total ? Math.round(g.mem_used / g.mem_total * 100) : 0,
    vram: g.mem_total ? `${(g.mem_used / 1024).toFixed(1)} / ${(g.mem_total / 1024).toFixed(0)} GB` : '',
    extra: [g.temp !== undefined ? `${g.temp} °C` : '', g.power !== undefined ? `${Math.round(g.power)} W` : ''].filter(Boolean).join(' · '),
  }))
  return {
    name: m.name, cores, avg: cores.length ? Math.round(cores.reduce((t, c) => t + c.pct, 0) / cores.length) : 0, gpus, points, limit: y(m.nproc), hot: m.loadavg[0] > m.nproc * 0.9, stale: m.stale,
    text: `${m.loadavg[0].toFixed(0)} load / ${m.nproc} cores (${(m.loadavg[0] / m.nproc).toFixed(1)}×)${m.memUsed !== undefined ? ` · mem ${Math.round(m.memUsed * 100)} %` : ''}${gpu}`,
    limitPct: (Number(y(m.nproc)) / 22 * 100).toFixed(0),
    top: m.top.map(p => `${p.user} ${p.pcpu}% ${p.cmd}`).join('\n'),
  }
}

async function load() {
  try {
    const response = await fetch('/__preview_comments/mesh', { headers: { 'X-Preview-Comment': '1' } })
    if (!response.ok) throw new Error()
    const data = await response.json()
    members = data.members
    edges = data.edges ?? []
    machines.value = (data.machines ?? []).map(machineOf)
    rows.value = members.filter(m => m.session).map(rowOf)
    hideSource(rows.value.length > 0)
    model.value = layout()
  } catch {
    note.value = 'Live team status needs a running preview.'
    return
  }
  note.value = members.length ? '' : 'No team table found.'
}

onMounted(() => { load(); timer = setInterval(load, 10000) })
onUnmounted(() => { hideSource(false); clearInterval(timer) })
</script>

<template>
  <div class="team-graph">
    <div class="team-graph-tabs" role="tablist">
      <button v-for="[value, label] in VIEWS" :key="value" role="tab" :aria-selected="view === value" :class="{ on: view === value }" @click="pick(value)">{{ label }}</button>
    </div>
    <svg v-show="model.nodes.length" class="team-graph-canvas" viewBox="0 0 900 460" preserveAspectRatio="xMidYMid meet">
      <g v-for="b in model.boxes" :key="b.label + b.x + b.y">
        <rect :x="b.x" :y="b.y" :width="b.w" :height="b.h" rx="14" class="box" />
        <text :x="b.x + 12" :y="b.y + 18" class="box-label">{{ b.label }}</text>
      </g>
      <line v-for="l in model.links" :key="l.a.key + l.b.key" :x1="l.a.x" :y1="l.a.y" :x2="l.b.x" :y2="l.b.y" class="tie" />
      <g v-for="p in model.pulses" :key="p.key">
        <line :x1="p.a.x" :y1="p.a.y" :x2="p.b.x" :y2="p.b.y" class="msg" />
        <circle r="4" fill="#fab387" opacity="0">
          <animateMotion :path="`M ${p.a.x} ${p.a.y} L ${p.b.x} ${p.b.y}`" dur="5s" :begin="p.delay + 's'" repeatCount="indefinite" calcMode="linear" keyPoints="0;1;1" keyTimes="0;.28;1" />
          <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;.02;.27;.28;1" dur="5s" :begin="p.delay + 's'" repeatCount="indefinite" />
        </circle>
        <circle :cx="p.b.x" :cy="p.b.y" r="12" fill="none" stroke="#fab387" stroke-width="2" opacity="0">
          <animate attributeName="r" values="12;12;30;30" keyTimes="0;.28;.42;1" dur="5s" :begin="p.delay + 's'" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;0;.8;0;0" keyTimes="0;.28;.29;.42;1" dur="5s" :begin="p.delay + 's'" repeatCount="indefinite" />
        </circle>
      </g>
      <g v-for="n in model.nodes" :key="n.key" :opacity="n.st === 'offline' ? 0.4 : 1">
        <circle v-if="n.solid" :cx="n.x" :cy="n.y" r="20" :fill="n.colour" opacity=".22">
          <animate v-if="n.st === 'working'" attributeName="r" values="20;23;20" dur="2s" repeatCount="indefinite" />
          <animate v-else-if="n.st === 'waiting' || n.st === 'asking'" attributeName="r" values="20;25;20" dur="1.6s" repeatCount="indefinite" />
        </circle>
        <rect v-if="n.human" :x="n.x - 10" :y="n.y - 10" width="20" height="20" rx="4" :fill="n.colour" />
        <circle v-else :cx="n.x" :cy="n.y" r="11" :fill="n.solid ? n.colour : '#1b1d22'" :stroke="n.solid ? '#1b1d22' : n.colour" :stroke-width="n.solid ? 3 : 2" />
        <path v-if="n.st === 'working'" :d="`M ${n.x + 17} ${n.y} A 17 17 0 0 1 ${n.x + 17 * Math.cos(1.6)} ${n.y + 17 * Math.sin(1.6)}`" fill="none" stroke="#e6edf7" stroke-width="2.5" stroke-linecap="round">
          <animateTransform attributeName="transform" type="rotate" :from="`0 ${n.x} ${n.y}`" :to="`360 ${n.x} ${n.y}`" dur="3.1s" repeatCount="indefinite" />
        </path>
        <text :x="n.x" :y="n.y + 30" class="name">{{ n.name }}</text>
        <text v-if="n.doing" :x="n.x" :y="n.y + 44" class="doing">{{ n.doing }}</text>
      </g>
    </svg>
    <p v-if="note" class="team-graph-note">{{ note }}</p>
    <table v-if="rows.length" class="team-live">
      <thead><tr><th>Who</th><th>Status</th><th>Doing</th><th>Machine</th></tr></thead>
      <tbody>
        <tr v-for="r in rows" :key="r.key">
          <td>{{ r.name }}</td>
          <td class="st"><span class="d" :class="[r.st === 'active' || r.st === 'offline' ? 'ring' : r.st, { off: r.st === 'offline' }]"></span>{{ r.status }}</td>
          <td>{{ r.doing }}</td><td>{{ r.machine }}</td>
        </tr>
      </tbody>
    </table>
    <div v-if="machines.length" class="team-machines">
      <p class="mach-title">Machines: load average last hour (line), per-core load now (bars), GPUs</p>
      <div v-for="m in machines" :key="m.name" class="mach-block">
        <div class="mach" :class="{ stale: m.stale || m.error }" :title="m.top">
          <span>{{ m.name }}</span>
          <span v-if="m.error">{{ m.error }}</span>
          <div v-else class="spark"><span class="limit" :style="{ top: m.limitPct + '%' }">all cores busy</span><svg viewBox="0 0 100 22" preserveAspectRatio="none"><line x1="0" x2="100" :y1="m.limit" :y2="m.limit" stroke="#59616d" stroke-dasharray="2 2" /><polyline :points="m.points" fill="none" :stroke="m.hot ? '#f38ba8' : '#6fb7e8'" stroke-width="1.5" vector-effect="non-scaling-stroke" /></svg></div>
          <span :class="{ hot: m.hot }">{{ m.text }}</span>
        </div>
        <div v-if="m.cores?.length || m.gpus?.length" class="mach-detail" :class="{ stale: m.stale }">
          <div v-if="m.cores.length" class="cores-wrap">
            <span class="scale"><span>100 %</span><span>0</span></span>
            <div class="cores" title="Per-core CPU load, last sample">
              <span v-for="c in m.cores" :key="c.i" class="core" :title="`core ${c.i}: ${Math.round(c.pct)} %`"><i :style="{ height: c.pct + '%', background: c.color }"></i><em>{{ Math.round(c.pct) }}</em></span>
            </div>
            <span class="avg">avg {{ m.avg }} %</span>
          </div>
          <div v-for="g in m.gpus" :key="g.label" class="gpu">
            <span class="gpu-label">{{ g.label }}</span>
            <span class="bar" :title="`util ${g.util} %`"><i :style="{ width: g.util + '%', background: g.utilColor }"></i></span>
            <span>util {{ g.util }} %</span>
            <span class="bar" :title="g.vram"><i :style="{ width: g.vramPct + '%', background: '#6fb7e8' }"></i></span>
            <span>VRAM {{ g.vram }}</span>
            <span class="gpu-extra">{{ g.extra }}</span>
          </div>
        </div>
      </div>
      <div class="mach axis"><span></span><span class="ticks"><span>−60 min</span><span>now</span></span><span></span></div>
    </div>
    <p class="team-graph-legend"><span class="d working"></span>working <span class="d waiting"></span>waiting <span class="d asking"></span>asking <span class="d idle"></span>idle <span class="d ring"></span>active <span class="d ring off"></span>offline · a pulse travels from sender to receiver for each message in the last hour</p>
  </div>
</template>

<style scoped>
.team-graph { margin: 16px 0 }
.team-machines { margin: 12px 0 }
.mach { display: grid; grid-template-columns: 140px 1fr 330px; gap: 10px; align-items: center; font-size: 13px; padding: 2px 0 }
.mach svg { width: 100%; height: 28px; display: block }
.mach-title { margin: 0 0 4px; font-size: 13px; opacity: .8 }
.spark { position: relative }
.spark .limit { position: absolute; right: 2px; transform: translateY(-100%); font-size: 10px; opacity: .6; pointer-events: none }
.mach.axis { font-size: 10px; opacity: .6 }
.mach .ticks { display: flex; justify-content: space-between }
.mach .hot { color: #f38ba8 }
.mach.stale { opacity: .5 }
.mach-detail { display: grid; gap: 4px; margin: 6px 0 10px; padding: 6px 8px; border: 1px solid var(--vp-c-divider); border-radius: 8px; font-size: 12px }
.mach-detail.stale { opacity: .5 }
.cores-wrap { display: flex; gap: 8px; align-items: stretch }
.scale { display: flex; flex-direction: column; justify-content: space-between; font-size: 10px; opacity: .6; text-align: right; min-width: 34px }
.avg { align-self: center; opacity: .85; white-space: nowrap }
.cores { display: flex; gap: 2px; height: 48px; align-items: flex-end; flex: 1 }
.core { flex: 1; max-width: 22px; height: 100%; display: flex; align-items: flex-end; background: var(--vp-c-bg-soft); border-radius: 2px; overflow: hidden }
.core { position: relative }
.core i { display: block; width: 100%; min-height: 1px }
.core em { position: absolute; top: 0; left: 0; right: 0; text-align: center; font-style: normal; font-size: 9px; opacity: .65 }
.gpu { display: grid; grid-template-columns: 150px 1fr 70px 1fr 110px 100px; gap: 8px; align-items: center }
.gpu-label, .gpu-extra { opacity: .8 }
.bar { position: relative; height: 16px; background: var(--vp-c-bg-soft); border-radius: 3px; overflow: hidden }
.bar i { position: absolute; inset: 0 auto 0 0; display: block }
.team-graph-tabs { display: flex; gap: 4px; margin-bottom: 6px }
.team-graph-tabs button { border: 1px solid var(--vp-c-divider); background: var(--vp-c-bg-soft); color: var(--vp-c-text-2); border-radius: 6px; padding: 3px 12px; cursor: pointer }
.team-graph-tabs button.on { color: var(--vp-c-text-1); border-color: var(--vp-c-brand-1) }
.team-graph-canvas { width: 100%; height: auto; display: block; border: 1px solid var(--vp-c-divider); border-radius: 8px; background: var(--vp-c-bg-soft) }
.team-graph-note { color: var(--vp-c-text-2); font-size: 13px }
.team-graph-legend { font-size: 12px; color: var(--vp-c-text-2) }
.d { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin: 0 4px 0 10px; background: #868e96 }
.d.working { background: #6fb7e8 } .d.waiting { background: #f38ba8 } .d.asking { background: #ffd500 } .d.idle { background: #9ccc65 } .d.ring { background: none; border: 2px solid #9399b2; box-sizing: border-box } .d.ring.off { opacity: .4 }
.team-live { width: 100%; border-collapse: collapse; font-size: 14px; margin: 14px 0 }
.team-live th, .team-live td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--vp-c-divider) }
.team-live td.st { white-space: nowrap } .team-live .d { margin: 0 6px 0 0 }
.box { fill: rgba(42,47,56,.45); stroke: #59616d } .box-label { fill: #aab; font: bold 13px sans-serif }
.tie { stroke: #59616d; stroke-width: 1.5 } .msg { stroke: #adb5bd; stroke-width: 1; opacity: .25 }
.name { fill: #e6edf7; font: 13px sans-serif; text-anchor: middle } .doing { fill: #e6edf7; opacity: .65; font: 11px ui-monospace, monospace; text-anchor: middle }
</style>
