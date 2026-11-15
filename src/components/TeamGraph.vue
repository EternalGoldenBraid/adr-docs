<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import cytoscape from 'cytoscape'

// Live team graph: roster agents as nodes, grouped by their "Working on" text, coloured by mesh status.
// Needs the preview's comment bridge; the built site shows a note instead.
const host = ref(null)
const note = ref('Loading team…')
let cy = null
let timer = null

const COLOURS = { active: '#51cf66', idle: '#fcc419', stopped: '#868e96', unknown: '#868e96' }
const state = m => {
  if (m.status !== 'active') return m.status === 'stopped' ? 'stopped' : 'unknown'
  return m.lastSeen && Date.now() - Date.parse(m.lastSeen) > 120000 ? 'idle' : 'active'
}

async function load() {
  let members
  try {
    const response = await fetch('/__preview_comments/mesh', { headers: { 'X-Preview-Comment': '1' } })
    if (!response.ok) throw new Error()
    members = (await response.json()).members.filter(m => m.session)
  } catch {
    note.value = 'Live team status needs a running preview.'
    return
  }
  note.value = members.length ? '' : 'No agents with a Session in the team table.'
  const groups = [...new Set(members.map(m => m.work || ''))]
  const next = new Map()
  const elements = [
    ...groups.filter(Boolean).map(g => ({ data: { id: 'g:' + g, label: g, group: true } })),
    ...members.map(m => {
      const column = groups.indexOf(m.work || ''), row = next.get(column) ?? 0
      next.set(column, row + 1)
      return { data: { id: m.session, label: m.name + (m.machine ? '\n' + m.machine : ''), parent: m.work ? 'g:' + m.work : undefined, colour: COLOURS[state(m)] }, position: { x: column * 170, y: row * 90 } }
    }),
  ]
  cy.json({ elements })
  cy.layout({ name: 'preset' }).run()
  cy.fit(undefined, 24)
}

onMounted(() => {
  cy = cytoscape({
    container: host.value,
    userZoomingEnabled: false,
    style: [
      { selector: 'node', style: { label: 'data(label)', 'text-wrap': 'wrap', 'font-size': 11, color: '#e8ecf1', 'text-valign': 'bottom', 'text-margin-y': 4, 'background-color': 'data(colour)', width: 34, height: 34, 'border-width': 2, 'border-color': '#1b1d22' } },
      { selector: 'node[?group]', style: { shape: 'round-rectangle', 'background-color': '#2a2f38', 'background-opacity': 0.55, 'border-color': '#59616d', 'border-width': 1, 'text-valign': 'top', 'text-margin-y': -6, 'font-size': 12, padding: 18, width: 'label', height: 'label' } },
    ],
  })
  load()
  timer = setInterval(load, 10000)
})
onUnmounted(() => { clearInterval(timer); cy?.destroy() })
</script>

<template>
  <div class="team-graph">
    <div ref="host" class="team-graph-canvas"></div>
    <p v-if="note" class="team-graph-note">{{ note }}</p>
    <p class="team-graph-legend"><span class="d active"></span>active <span class="d idle"></span>idle <span class="d stopped"></span>offline</p>
  </div>
</template>

<style scoped>
.team-graph { margin: 16px 0 }
.team-graph-canvas { height: 360px; border: 1px solid var(--vp-c-divider); border-radius: 8px; background: var(--vp-c-bg-soft) }
.team-graph-note { color: var(--vp-c-text-2); font-size: 13px }
.team-graph-legend { font-size: 12px; color: var(--vp-c-text-2) }
.d { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin: 0 4px 0 10px; background: #868e96 }
.d.active { background: #51cf66 } .d.idle { background: #fcc419 }
</style>
