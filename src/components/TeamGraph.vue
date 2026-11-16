<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import cytoscape from 'cytoscape'

// Live team graph with three views of the roster (Topic, Machine, Command), nodes coloured by mesh status.
// Needs the preview's comment bridge; the built site shows a note instead.
const VIEWS = [['topic', 'Topic'], ['machine', 'Machine'], ['command', 'Command']]
const host = ref(null)
const note = ref('Loading team…')
const view = ref((typeof localStorage !== 'undefined' && localStorage.getItem('team-graph-view')) || 'topic')
let cy = null
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

function build() {
  if (!cy) return
  const mode = view.value
  const groupOf = m => mode === 'topic' ? m.topic : mode === 'machine' ? m.machine : ''
  const keys = [...new Set(members.map(m => groupOf(m) || ''))]
  const elements = [], seen = new Set(), rows = new Map()
  const group = (key, label, parent) => { if (!seen.has(key)) { seen.add(key); elements.push({ data: { id: key, label, group: true, parent } }) } }
  const ordered = mode === 'machine' ? [...members].sort((a, b) => (a.topic || '').localeCompare(b.topic || '')) : members
  for (const m of ordered) {
    const column = keys.indexOf(groupOf(m) || ''), row = rows.get(column) ?? 0
    rows.set(column, row + 1)
    // Topic groups wrap into rows of four; machine columns stack their topics with room for nested labels.
    const position = mode === 'topic' ? { x: (column % 4) * 280 + (row % 2) * 120, y: Math.floor(column / 4) * 200 + Math.floor(row / 2) * 110 } : { x: column * 300, y: row * 200 }
    let parent
    if (mode === 'topic' && m.topic) { parent = 'g:' + m.topic; group(parent, m.topic) }
    if (mode === 'machine' && m.machine) {
      group('g:' + m.machine, m.machine)
      if (m.topic) { parent = 'g:' + m.machine + ':' + m.topic; group(parent, m.topic, 'g:' + m.machine) } else parent = 'g:' + m.machine
    }
    const doing = m.statusLine?.doing || m.work
    const label = m.name + (doing ? '\n' + clip(doing, 34) : '')
    elements.push({ data: { id: id(m), label, parent, colour: COLOURS[state(m)], hollow: hollow(state(m)), off: state(m) === 'offline', human: !m.session }, position })
  }
  if (mode === 'command') {
    // Tidy tree: each subtree takes the width of its leaves, so children stay under their parent.
    const byName = new Map(members.map(m => [slug(m.name), m]))
    const kids = new Map(members.map(m => [id(m), []]))
    const top = []
    for (const m of members) {
      const boss = m.reportsTo && byName.get(slug(m.reportsTo))
      if (boss && boss !== m) { kids.get(id(boss)).push(m); elements.push({ data: { id: 'e:' + id(m), source: id(boss), target: id(m) } }) } else top.push(m)
    }
    const place = (m, left, depth, trail) => {
      const children = trail.has(id(m)) ? [] : kids.get(id(m))
      let width = 0
      for (const child of children) width += place(child, left + width, depth + 1, new Set([...trail, id(m)]))
      width = Math.max(width, 1)
      const node = elements.find(e => e.data.id === id(m))
      node.position = { x: (left + width / 2) * 200, y: depth * 150 }
      return width
    }
    let left = 0
    for (const m of top) left += place(m, left, 0, new Set())
  }
  // Recent messages between agents, thicker with count; kept apart from the reporting lines of the Command view.
  const ids = new Set(elements.filter(e => !e.data.group && !e.data.source).map(e => e.data.id))
  for (const e of edges) if (ids.has(e.from) && ids.has(e.to)) elements.push({ data: { id: `m:${e.from}>${e.to}`, source: e.from, target: e.to, msg: true, w: Math.min(6, 1 + e.count) } })
  cy.json({ elements })
  cy.layout({ name: 'preset', padding: 30 }).run()
  cy.fit(undefined, 30)
}

function pick(value) {
  view.value = value
  localStorage.setItem('team-graph-view', value)
  build()
}

async function load() {
  try {
    const response = await fetch('/__preview_comments/mesh', { headers: { 'X-Preview-Comment': '1' } })
    if (!response.ok) throw new Error()
    const data = await response.json()
    members = data.members
    edges = data.edges ?? []
    rows.value = members.filter(m => m.session).map(rowOf)
    hideSource(rows.value.length > 0)
  } catch {
    note.value = 'Live team status needs a running preview.'
    return
  }
  note.value = members.length ? '' : 'No team table found.'
  build()
}

onMounted(() => {
  cy = cytoscape({
    container: host.value,
    userZoomingEnabled: false,
    style: [
      { selector: 'node', style: { label: 'data(label)', 'text-wrap': 'wrap', 'font-size': 15, color: '#f1f3f5', 'text-valign': 'bottom', 'text-margin-y': 6, 'background-color': 'data(colour)', width: 46, height: 46, 'border-width': 3, 'border-color': '#1b1d22' } },
      { selector: 'node[?human]', style: { shape: 'round-rectangle', 'border-color': '#e6edf7' } },
      { selector: 'node[?hollow]', style: { 'background-opacity': 0, 'border-color': 'data(colour)', 'underlay-opacity': 0 } },
      { selector: 'node[?off]', style: { opacity: 0.4 } },
      { selector: 'node[colour]', style: { 'underlay-color': 'data(colour)', 'underlay-opacity': 0.22, 'underlay-padding': 9, 'underlay-shape': 'ellipse' } },
      { selector: 'node[?hollow]', style: { 'underlay-opacity': 0 } },
      { selector: 'node[?group]', style: { shape: 'round-rectangle', 'background-color': '#2a2f38', 'background-opacity': 0.55, 'border-color': '#59616d', 'border-width': 1, 'text-valign': 'top', 'text-margin-y': -8, 'font-size': 17, 'font-weight': 'bold', padding: 24, width: 'label', height: 'label' } },
      { selector: 'edge', style: { width: 2, 'line-color': '#74c0fc', 'target-arrow-color': '#74c0fc', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier' } },
      { selector: 'edge[?msg]', style: { width: 'data(w)', 'line-style': 'dashed', 'line-color': '#adb5bd', 'target-arrow-color': '#adb5bd', opacity: 0.7, 'curve-style': 'unbundled-bezier', 'control-point-distances': [40], 'control-point-weights': [0.5] } },
    ],
  })
  load()
  timer = setInterval(load, 10000)
})
onUnmounted(() => { hideSource(false); clearInterval(timer); cy?.destroy() })
</script>

<template>
  <div class="team-graph">
    <div class="team-graph-tabs" role="tablist">
      <button v-for="[value, label] in VIEWS" :key="value" role="tab" :aria-selected="view === value" :class="{ on: view === value }" @click="pick(value)">{{ label }}</button>
    </div>
    <div ref="host" class="team-graph-canvas"></div>
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
    <p class="team-graph-legend"><span class="d working"></span>working <span class="d waiting"></span>waiting <span class="d asking"></span>asking <span class="d idle"></span>idle <span class="d ring"></span>active <span class="d ring off"></span>offline · dashed lines: messages in the last hour</p>
  </div>
</template>

<style scoped>
.team-graph { margin: 16px 0 }
.team-graph-tabs { display: flex; gap: 4px; margin-bottom: 6px }
.team-graph-tabs button { border: 1px solid var(--vp-c-divider); background: var(--vp-c-bg-soft); color: var(--vp-c-text-2); border-radius: 6px; padding: 3px 12px; cursor: pointer }
.team-graph-tabs button.on { color: var(--vp-c-text-1); border-color: var(--vp-c-brand-1) }
.team-graph-canvas { height: 460px; border: 1px solid var(--vp-c-divider); border-radius: 8px; background: var(--vp-c-bg-soft) }
.team-graph-note { color: var(--vp-c-text-2); font-size: 13px }
.team-graph-legend { font-size: 12px; color: var(--vp-c-text-2) }
.d { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin: 0 4px 0 10px; background: #868e96 }
.d.working { background: #6fb7e8 } .d.waiting { background: #f38ba8 } .d.asking { background: #ffd500 } .d.idle { background: #9ccc65 } .d.ring { background: none; border: 2px solid #9399b2; box-sizing: border-box } .d.ring.off { opacity: .4 }
.team-live { width: 100%; border-collapse: collapse; font-size: 14px; margin: 14px 0 }
.team-live th, .team-live td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--vp-c-divider) }
.team-live td.st { white-space: nowrap } .team-live .d { margin: 0 6px 0 0 }
</style>
