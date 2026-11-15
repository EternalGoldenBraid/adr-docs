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
let members = []

const COLOURS = { active: '#51cf66', idle: '#fcc419', stopped: '#868e96', unknown: '#868e96', human: '#74c0fc' }
const state = m => {
  if (m.status !== 'active') return COLOURS[m.status] ? m.status : 'unknown'
  return m.lastSeen && Date.now() - Date.parse(m.lastSeen) > 120000 ? 'idle' : 'active'
}
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
    const label = m.name + (m.work && mode !== 'command' ? '\n' + m.work : '') + (mode === 'command' && m.role ? '\n' + m.role : '')
    elements.push({ data: { id: id(m), label, parent, colour: COLOURS[state(m)], human: !m.session }, position })
  }
  if (mode === 'command') {
    const byName = new Map(members.map(m => [slug(m.name), m]))
    for (const m of members) {
      const boss = m.reportsTo && byName.get(slug(m.reportsTo))
      if (boss) elements.push({ data: { id: 'e:' + id(m), source: id(boss), target: id(m) } })
    }
  }
  cy.json({ elements })
  cy.layout(mode === 'command'
    ? { name: 'breadthfirst', directed: true, spacingFactor: 1.5, padding: 30, animate: false }
    : { name: 'preset', padding: 30 }).run()
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
    members = (await response.json()).members
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
      { selector: 'node[?human]', style: { shape: 'round-rectangle', 'border-color': '#74c0fc' } },
      { selector: 'node[?group]', style: { shape: 'round-rectangle', 'background-color': '#2a2f38', 'background-opacity': 0.55, 'border-color': '#59616d', 'border-width': 1, 'text-valign': 'top', 'text-margin-y': -8, 'font-size': 17, 'font-weight': 'bold', padding: 24, width: 'label', height: 'label' } },
      { selector: 'edge', style: { width: 2, 'line-color': '#74c0fc', 'target-arrow-color': '#74c0fc', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier' } },
    ],
  })
  load()
  timer = setInterval(load, 10000)
})
onUnmounted(() => { clearInterval(timer); cy?.destroy() })
</script>

<template>
  <div class="team-graph">
    <div class="team-graph-tabs" role="tablist">
      <button v-for="[value, label] in VIEWS" :key="value" role="tab" :aria-selected="view === value" :class="{ on: view === value }" @click="pick(value)">{{ label }}</button>
    </div>
    <div ref="host" class="team-graph-canvas"></div>
    <p v-if="note" class="team-graph-note">{{ note }}</p>
    <p class="team-graph-legend"><span class="d active"></span>active <span class="d idle"></span>idle <span class="d stopped"></span>offline <span class="d human"></span>human</p>
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
.d.active { background: #51cf66 } .d.idle { background: #fcc419 } .d.human { background: #74c0fc }
</style>
