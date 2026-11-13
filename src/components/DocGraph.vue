<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import cytoscape from 'cytoscape'

// src: URL of the graph JSON (served from the document's public/ folder).
// Local edits are autosaved in the browser under storageKey.
const props = defineProps({ src: { type: String, required: true }, storageKey: { type: String, default: '' }, title: { type: String, default: 'Graph' }, height: { type: String, default: '' } })
const STORE = props.storageKey || 'doc-graph:' + props.src
const host = ref(null)
const titleInput = ref(null)
const selected = ref(null)
const editor = ref(null)
const editorBox = ref({ left: 0, top: 0, width: 240 })
const connecting = ref(false)
const editMode = ref(false)
const help = ref(false)
const mode = ref('normal')
const vimOn = ref(typeof localStorage === 'undefined' || localStorage.getItem('preview-comments-vim') !== 'off')
const cmd = ref(null)
const cmdInput = ref(null)
const flash = ref('')
const selTitle = computed(() => (selected.value && cy ? cy.getElementById(selected.value).data('title') || '' : ''))
const HELP = "DOC-GRAPH(1)\n\nMODES\n  NORMAL  fly the view         VISUAL  walk node to node\n  INSERT  edit the graph       Esc     back to NORMAL\nNORMAL\n  h j k l   pan (H J K L: faster)\n  + - 0     zoom in / out / fit\n  v  visual     i  insert     u  up one layer\n  Enter     open the selected \u25b8 layer\nVISUAL\n  h j k l   nearest node in that direction\n  Enter     open \u25b8 layer, or zoom to node\n  c         comment on the node\nINSERT\n  h j k l   select neighbour\n  arrows    nudge node (shift: x5)\n  Enter     edit text    o  new node    x  delete\nCOMMANDS\n  :help :man   this page     :w  export JSON\n  :fit         fit all       :q  close\nMOUSE / TRACKPAD\n  swipe pans \u00b7 pinch or shift+swipe zooms\n  dbl-click: \u25b8 opens, node/lane zooms, empty fits"
const topic = ref('')
const TOPICS = ref([])
let cy = null
let ro = null
let moved = false
let bodiesShown = true

const SHOW_BODY_ZOOM = 0.55

function nodeLabel(n) {
  const head = (n.data('title') || '') + (n.data('status') ? '  ' + n.data('status') : '') + (n.data('badge') || '')
  const body = n.data('body') || ''
  if (!body || !cy || cy.zoom() < SHOW_BODY_ZOOM || n.data('kind') !== 'node') return head
  const w = n.data('w'), h = n.data('h')
  const room = Math.max(0, Math.floor((h - 38) / 14)) * Math.floor((w - 24) / 7.2)
  const text = body.length > room ? body.slice(0, Math.max(0, room - 1)).trimEnd() + '…' : body
  return room > 12 ? head + '\n' + text : head
}

function nodeEl(n) {
  const d = { id: n.id, title: n.title, body: n.body, status: n.status, kind: n.kind, topics: n.topics,
    w: n.w, h: n.h, fill: n.fill, stroke: n.stroke, font: n.font }
  if (n.parent) d.parent = n.parent
  if (n.inside) d.inside = n.inside
  return { group: 'nodes', data: d, position: { x: n.x, y: n.y } }
}

function edgeEl(e) {
  return { group: 'edges', data: { id: e.id, source: e.source, target: e.target, color: e.color, dashed: e.dashed, label: e.label || '' } }
}

function serialise() {
  return {
    nodes: cy.nodes().map(n => {
      const d = n.data()
      return { id: d.id, title: d.title, body: d.body, status: d.status, kind: d.kind, parent: d.parent || null, inside: d.inside || null,
        x: Math.round(n.position('x')), y: Math.round(n.position('y')), w: d.w, h: d.h,
        fill: d.fill, stroke: d.stroke, font: d.font, topics: d.topics }
    }),
    edges: cy.edges().map(e => ({ id: e.id(), source: e.data('source'), target: e.data('target'),
      color: e.data('color'), dashed: !!e.data('dashed'), label: e.data('label') || '' })),
  }
}

const save = () => localStorage.setItem(STORE, JSON.stringify(serialise()))

const layer = ref(null)
const layerTitle = ref('')

const childrenOf = id => cy.nodes().filter(n => n.data('inside') === id)

function showLayer(id) {
  layer.value = id
  layerTitle.value = id ? cy.getElementById(id).data('title') : ''
  const visible = cy.nodes().filter(n => (n.data('inside') || null) === id && (n.data('kind') !== 'lane' || !id))
  cy.batch(() => {
    cy.elements().style('display', 'none')
    visible.style('display', 'element')
    visible.edgesWith(visible).style('display', 'element')
    cy.nodes().forEach(n => {
      const k = childrenOf(n.id()).length
      n.data('badge', k ? `  ▸ ${k}` : '')
    })
  })
  select(null)
  cy.resize()
  cy.fit(visible, 40)
  moved = false
}

function select(n) {
  selected.value = n ? n.id() : null
  editor.value = null
}

function startEdit() {
  const n = cy.getElementById(selected.value)
  if (!n.length) return
  const p = n.renderedPosition()
  const w = Math.max(240, n.renderedWidth())
  editorBox.value = { left: p.x - w / 2, top: p.y - n.renderedHeight() / 2, width: w }
  editor.value = { title: n.data('title') || '', body: n.data('body') || '', status: n.data('status') || '' }
  nextTick(() => titleInput.value && titleInput.value.focus())
}

function commitEdit() {
  if (!editor.value) return
  const n = cy.getElementById(selected.value)
  if (n.length) n.data({ title: editor.value.title, body: editor.value.body, status: editor.value.status })
  editor.value = null
  save()
}

function addNode(owner) {
  const ext = cy.extent()
  const inside = owner === undefined ? layer.value : owner
  const around = owner ? childrenOf(owner) : null
  const base = around && around.length ? around.boundingBox() : null
  const pos = base ? { x: base.x1, y: base.y2 + 60 } : { x: (ext.x1 + ext.x2) / 2, y: (ext.y1 + ext.y2) / 2 }
  const id = 'n' + Date.now().toString(36)
  const data = { id, title: 'New node', body: '', status: '', kind: 'node', w: 220, h: 70,
    fill: '#1e293b', stroke: '#64748b', font: '#e2e8f0', topics: null }
  if (inside) data.inside = inside
  const n = cy.add({ group: 'nodes', data, position: pos })
  if (owner) showLayer(owner)
  n.style('display', 'element')
  select(n)
  save()
  startEdit()
}

function removeSelected() {
  const n = cy.getElementById(selected.value)
  if (!n.length) return
  childrenOf(n.id()).remove()
  n.remove()
  select(null)
  save()
}

function openSelected() {
  const id = selected.value
  if (id) showLayer(id)
}

const hasLayer = () => selected.value && childrenOf(selected.value).length > 0
const back = () => { const o = cy.getElementById(layer.value); showLayer(o.data('inside') || null) }

function applyTopic() {
  cy.batch(() => {
    cy.elements().removeClass('dim')
    if (!topic.value) return
    cy.nodes().forEach(n => {
      const t = n.data('topics') || []
      if (!t.includes(topic.value)) n.addClass('dim')
    })
    cy.edges().forEach(e => {
      if (e.source().hasClass('dim') || e.target().hasClass('dim')) e.addClass('dim')
    })
  })
}

function setMode(m) {
  mode.value = m
  const on = m === 'insert'
  editMode.value = on
  cy.autoungrabify(!on)
  if (!on) { editor.value = null; connecting.value = false }
  document.dispatchEvent(new CustomEvent('preview-comment-mode', { detail: { mode: m.toUpperCase() } }))
  if (m === 'visual' && !selected.value) {
    const c = { x: cy.width() / 2, y: cy.height() / 2 }
    const near = cy.nodes().filter(isNav).sort((p, q) => dist(p, c) - dist(q, c))[0]
    if (near) selectNode(near)
  }
}

function exportJson() {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(serialise(), null, 1)], { type: 'application/json' }))
  a.download = 'graph.json'
  a.click()
}

async function reset() {
  localStorage.removeItem(STORE)
  location.reload()
}

onMounted(async () => {
  let data = null
  try { data = JSON.parse(localStorage.getItem(STORE)) } catch (_) { /* fall back to the file */ }
  const fromFile = !data
  if (!data) data = await (await fetch(props.src)).json()

  TOPICS.value = [...new Set(data.nodes.flatMap(n => n.topics || []))].sort()
  document.addEventListener('preview-comment-vim', onVim)
  cy = cytoscape({
    container: host.value,
    elements: [...data.nodes.map(nodeEl), ...data.edges.map(edgeEl)],
    userZoomingEnabled: false,
    autoungrabify: true,
    boxSelectionEnabled: false,
    minZoom: 0.1,
    maxZoom: 3,
    style: [
      { selector: 'node', style: {
        shape: 'round-rectangle', width: 'data(w)', height: 'data(h)',
        'background-color': 'data(fill)', 'border-color': 'data(stroke)', 'border-width': 2,
        label: nodeLabel,
        color: 'data(font)', 'font-size': 13, 'font-weight': 600, 'text-wrap': 'wrap',
        'text-max-width': n => n.data('w') - 16, 'text-valign': 'center', 'text-halign': 'center' } },
      { selector: ':parent', style: {
        'text-valign': 'top', 'text-halign': 'center', 'text-margin-y': -8, padding: 34,
        'compound-sizing-wrt-labels': 'exclude', 'background-opacity': 0.12, 'border-width': 2, 'font-size': 15,
        'text-background-color': 'data(stroke)', 'text-background-opacity': 1, 'text-background-padding': 7,
        'text-background-shape': 'round-rectangle', color: '#0b1220' } },
      { selector: 'node[kind = "text"]', style: { 'background-opacity': 0, 'border-width': 0, 'text-margin-x': n => -n.data('w') / 2 + (n.data('title') || '').length * 3.4 + 4, 'font-size': 12, 'font-weight': 500 } },
      { selector: 'edge', style: {
        width: 2, 'line-color': 'data(color)', 'target-arrow-color': 'data(color)', 'target-arrow-shape': 'triangle',
        'curve-style': 'taxi', 'taxi-direction': 'vertical', 'taxi-turn': '50%', 'taxi-radius': 8, opacity: 0.85 } },
      { selector: 'node[kind = "dot"]', style: { label: '', 'border-width': 0 } },
      { selector: 'edge[label]', style: { label: 'data(label)', 'font-size': 11, 'font-style': 'italic', color: '#cbd5e1', 'text-background-color': '#0b1220', 'text-background-opacity': 1, 'text-background-padding': 3 } },
      { selector: 'edge[?dashed]', style: { 'line-style': 'dashed' } },
      { selector: '.dim', style: { opacity: 0.12 } },
      { selector: ':selected', style: { 'border-color': '#facc15', 'border-width': 4 } },
    ],
    layout: { name: 'preset' },
  })

  // Same controls as the static graph: two-finger swipe pans, pinch (ctrl+wheel) zooms.
  host.value.addEventListener('wheel', e => {
    e.preventDefault()
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) {
      // Some systems turn Shift+swipe into horizontal scroll, hence the deltaX fallback
      const dy = e.deltaY || e.deltaX
      const r = host.value.getBoundingClientRect()
      const level = Math.min(cy.maxZoom(), Math.max(cy.minZoom(), cy.zoom() * Math.exp(-dy * (e.ctrlKey || e.metaKey ? 0.01 : 0.006))))
      cy.zoom({ level, renderedPosition: { x: e.clientX - r.left, y: e.clientY - r.top } })
    } else cy.panBy({ x: -e.deltaX, y: -e.deltaY })
  }, { passive: false })

  // Lets the doc-review overlay comment on canvas nodes and edges
  const titleOf = id => cy.getElementById(id).data('title') || id
  window.previewCommentTargets = {
    get(id) {
      const el = cy.getElementById(id)
      if (el.empty() || el.style('display') === 'none') return null
      const o = host.value.getBoundingClientRect()
      if (el.isNode()) {
        const b = el.renderedBoundingBox()
        const d = el.data()
        return { kind: 'node', rect: { left: o.left + b.x1, right: o.left + b.x2, top: o.top + b.y1, bottom: o.top + b.y2 },
          quote: `Graph node "${d.title}"${d.status ? ' ' + d.status : ''}${d.body ? ' — ' + d.body : ''}` }
      }
      const m = el.renderedMidpoint()
      const label = el.data('label')
      return { kind: 'edge', rect: { left: o.left + m.x - 6, right: o.left + m.x + 6, top: o.top + m.y - 6, bottom: o.top + m.y + 6 },
        quote: `Graph edge "${titleOf(el.data('source'))}" → "${titleOf(el.data('target'))}"${label ? ` (${label})` : ''}` }
    },
  }
  const pick = e => { if (e.target !== cy) document.dispatchEvent(new CustomEvent('preview-comment-pick', { detail: { id: e.target.id() } })) }
  cy.on('tap', 'node', pick)
  cy.on('tap', 'edge', pick)
  cy.on('viewport drag position', () => document.dispatchEvent(new CustomEvent('preview-comment-reflow')))

  document.dispatchEvent(new CustomEvent('preview-comment-mode', { detail: { mode: 'NORMAL' } }))
  showLayer(null)
  ro = new ResizeObserver(() => { cy.resize(); if (!moved) { cy.fit(cy.nodes().filter(n => n.style('display') !== 'none'), 40); moved = false } })
  ro.observe(host.value)

  cy.on('tap', 'node', e => {
    if (connecting.value && selected.value && selected.value !== e.target.id()) {
      const a = selected.value, b = e.target.id()
      cy.add({ group: 'edges', data: { id: `${a}__${b}`, source: a, target: b, color: '#94a3b8', dashed: false } })
      connecting.value = false
      save()
      return
    }
    select(e.target)
  })
  cy.on('tap', e => { if (e.target === cy) select(null) })
  cy.on('dbltap', e => {
    if (e.target === cy) cy.animate({ fit: { eles: cy.nodes().filter(n => n.style('display') !== 'none'), padding: 40 }, duration: 250 })
  })
  cy.on('dbltap', 'node', e => {
    if (e.target.data('kind') === 'lane') {
      cy.animate({ fit: { eles: e.target, padding: 30 }, duration: 250 })
      return
    }
    if (childrenOf(e.target.id()).length) showLayer(e.target.id())
    else if (editMode.value) { select(e.target); startEdit() }
    else cy.animate({ fit: { eles: e.target, padding: 120 }, duration: 250 })
  })
  cy.on('pan zoom drag', () => { editor.value = null })
  cy.on('dragfree', 'node', e => {
    const p = e.target.position()
    e.target.position({ x: Math.round(p.x / 10) * 10, y: Math.round(p.y / 10) * 10 })
    save()
  })
  cy.on('zoom', () => {
    const show = cy.zoom() >= SHOW_BODY_ZOOM
    if (show !== bodiesShown) { bodiesShown = show; cy.style().update() }
  })
  cy.on('viewport', () => { moved = true })
})

const isNav = n => n.style('display') !== 'none' && n.data('kind') === 'node'
const dist = (n, c) => Math.hypot(n.renderedPosition('x') - c.x, n.renderedPosition('y') - c.y)
const fitAll = () => cy.animate({ fit: { eles: cy.nodes().filter(n => n.style('display') !== 'none'), padding: 40 }, duration: 250 })

function selectNode(n) {
  cy.elements().unselect()
  n.select()
  select(n)
  const p = n.renderedPosition()
  const m = 60
  if (p.x < m || p.y < m || p.x > cy.width() - m || p.y > cy.height() - m) cy.animate({ center: { eles: n }, duration: 150 })
}

// Nearest node within ~60° of the direction (dx, dy), judged by centre distance
function neighbour(dx, dy) {
  const cur = cy.getElementById(selected.value)
  if (!cur.length) return null
  const from = cur.position()
  let best = null, bestScore = Infinity
  cy.nodes().filter(isNav).forEach(n => {
    if (n.id() === cur.id()) return
    const vx = n.position('x') - from.x, vy = n.position('y') - from.y
    const along = vx * dx + vy * dy, across = Math.abs(vx * dy - vy * dx)
    if (along <= 5 || across > along * 1.7) return
    const score = along + across * 2
    if (score < bestScore) { best = n; bestScore = score }
  })
  return best
}

function say(text) {
  flash.value = text
  setTimeout(() => { if (flash.value === text) flash.value = '' }, 3000)
}

function runCmd() {
  const c = (cmd.value || '').trim()
  cmd.value = null
  if (['help', 'h', 'man'].includes(c)) help.value = true
  else if (['q', 'close'].includes(c)) help.value = false
  else if (c === 'w') exportJson()
  else if (c === 'fit') fitAll()
  else if (c) say('E492: Not an editor command: ' + c)
}

function onKey(e) {
  if (e.target.matches?.('input,textarea,select') || e.ctrlKey || e.metaKey || e.altKey) return
  if (e.key === '?') { help.value = !help.value; return }
  if (!vimOn.value) return
  const k = e.key
  if (k === 'Escape') {
    help.value = false
    if (mode.value !== 'normal') setMode('normal')
    return
  }
  if (k === ':') { e.preventDefault(); cmd.value = ''; nextTick(() => cmdInput.value && cmdInput.value.focus()); return }
  const dirs = { h: [-1, 0], j: [0, 1], k: [0, -1], l: [1, 0] }
  const arrows = { ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1], ArrowRight: [1, 0] }
  const done = () => e.preventDefault()
  const sel = () => cy.getElementById(selected.value)

  if (k === '+' || k === '=' || k === '-') {
    done()
    cy.zoom({ level: cy.zoom() * (k === '-' ? 1 / 1.25 : 1.25), renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } })
    return
  }
  if (k === '0') { done(); fitAll(); return }
  if (k === 'u' && layer.value) { done(); back(); return }
  if (k === 'i') { done(); setMode('insert'); return }
  if (k === 'v' && mode.value !== 'visual') { done(); setMode('visual'); return }

  if (mode.value === 'normal') {
    const d = dirs[k.toLowerCase()]
    if (d) { done(); const step = k === k.toUpperCase() ? 240 : 60; cy.panBy({ x: -d[0] * step, y: -d[1] * step }); return }
    if (k === 'Enter' && hasLayer()) { done(); openSelected() }
    return
  }
  if (mode.value === 'visual') {
    if (dirs[k]) { done(); const n = neighbour(...dirs[k]); if (n) selectNode(n); return }
    if (k === 'Enter' && selected.value) {
      done()
      if (hasLayer()) openSelected()
      else cy.animate({ fit: { eles: sel(), padding: 120 }, duration: 250 })
      return
    }
    if (k === 'c' && selected.value) { done(); document.dispatchEvent(new CustomEvent('preview-comment-open', { detail: { id: selected.value } })) }
    return
  }
  // insert
  if (dirs[k]) { done(); const n = neighbour(...dirs[k]); if (n) selectNode(n); return }
  if (arrows[k] && selected.value) {
    done()
    const step = e.shiftKey ? 50 : 10
    const n = sel()
    n.position({ x: n.position('x') + arrows[k][0] * step, y: n.position('y') + arrows[k][1] * step })
    save()
    return
  }
  if (k === 'Enter' && selected.value) { done(); startEdit() }
  else if (k === 'o') { done(); addNode() }
  else if (k === 'x' && selected.value) { done(); removeSelected() }
}
const onVim = e => { vimOn.value = e.detail.enabled }
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))

onUnmounted(() => { document.removeEventListener('preview-comment-vim', onVim); delete window.previewCommentTargets; if (ro) ro.disconnect(); if (cy) cy.destroy() })
</script>

<template>
<div class="xp">
  <div class="xp-bar">
    <strong>{{ title }}</strong>
    <button v-if="layer" @click="back">← Back</button>
    <strong v-if="layer">{{ layerTitle }}</strong>
    <select v-if="TOPICS.length" v-model="topic" @change="applyTopic"><option value="">All topics</option><option v-for="t in TOPICS" :key="t" :value="t">{{ t }}</option></select>
    <button :class="{ on: help }" title="Controls (?)" @click="help = !help">?</button>
    <button :class="{ on: editMode }" @click="setMode(editMode ? 'normal' : 'insert')">{{ editMode ? '✎ Editing' : '✎ Edit mode' }}</button>
    <template v-if="editMode && selected">
      <button v-if="hasLayer()" @click="openSelected">Open ▸</button>
      <button @click="startEdit">Edit</button>
      <button @click="addNode(selected)">+ Inside</button>
      <button :class="{ on: connecting }" @click="connecting = !connecting">Connect to…</button>
      <button @click="removeSelected">Delete</button>
      <span class="xp-sep"></span>
    </template>
    <template v-if="editMode">
      <button @click="addNode()">+ Node</button>
      <button @click="exportJson">Export JSON</button>
      <button @click="reset">Reset to file</button>
    </template>
  </div>
  <div class="xp-main">
    <div ref="host" class="xp-canvas" :style="height ? { height } : null"></div>
    <div class="xp-status"><span class="xp-mode" :data-mode="mode">{{ vimOn ? '-- ' + mode.toUpperCase() + ' --' : mode.toUpperCase() }}</span>
      <span v-if="selected" class="xp-sel">{{ selTitle }}</span><span class="xp-flash">{{ flash }}</span><span class="xp-hint">:help</span></div>
    <div v-if="cmd !== null" class="xp-cmd">:<input ref="cmdInput" v-model="cmd" spellcheck="false" @keydown.enter="runCmd" @keydown.esc="cmd = null" @keydown.backspace="!cmd && (cmd = null)" /></div>
    <div v-if="help" class="xp-help"><pre v-text="HELP"></pre></div>
    <div v-if="editor" class="xp-edit" :style="{ left: editorBox.left + 'px', top: editorBox.top + 'px', width: editorBox.width + 'px' }"
      @keydown.esc="editor = null">
      <input ref="titleInput" v-model="editor.title" placeholder="Title" @keydown.enter="commitEdit" />
      <input v-model="editor.status" placeholder="Status, e.g. ● MVP" @keydown.enter="commitEdit" />
      <textarea v-model="editor.body" rows="4" placeholder="Description" @keydown.ctrl.enter="commitEdit"></textarea>
      <div class="xp-actions"><button @click="commitEdit">Save</button><button @click="editor = null">Cancel</button></div>
    </div>
  </div>
</div>
</template>

<style>
.xp { padding: 8px 16px; color: var(--vp-c-text-1); }
.xp-bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 6px 0 10px; }
.xp-muted { color: var(--vp-c-text-2); font-size: 13px; flex: 1; }
.xp-main { display: flex; gap: 12px; }
.xp-canvas { flex: 1; min-width: 0; overflow: hidden; height: calc(100vh - 150px); border: 1px solid var(--vp-c-divider); border-radius: 12px; background: #0b1220; }
.xp-main { position: relative; }
.xp-edit { position: absolute; z-index: 5; display: flex; flex-direction: column; gap: 6px; padding: 10px; background: var(--vp-c-bg); border: 1px solid var(--vp-c-divider); border-radius: 12px; box-shadow: 0 8px 28px #0009; font-size: 13px; }
.xp-help { position: absolute; right: 12px; bottom: 30px; z-index: 6; padding: 8px 14px; background: #0b1220; color: #cbd5e1; border: 1px solid #475569; border-radius: 4px; font: 12px/1.4 ui-monospace, 'JetBrains Mono', Menlo, monospace; pointer-events: none; }
.xp-help pre { margin: 6px 0 0; font: inherit; background: none; padding: 0; }
.xp-status { position: absolute; left: 0; right: 0; bottom: 0; z-index: 4; display: flex; gap: 14px; align-items: center; padding: 2px 170px 2px 10px; background: #111827; color: #cbd5e1; border-radius: 0 0 12px 12px; font: 12px/1.6 ui-monospace, Menlo, monospace; pointer-events: none; }
.xp-mode { font-weight: 700; color: #4ade80; }
.xp-mode[data-mode="visual"] { color: #c084fc; }
.xp-mode[data-mode="insert"] { color: #facc15; }
.xp-flash { flex: 1; color: #fca5a5; }
.xp-hint { margin-left: auto; opacity: .6; }
.xp-cmd { position: absolute; left: 0; right: 0; bottom: 0; z-index: 7; display: flex; align-items: center; padding: 2px 10px; background: #111827; color: #e2e8f0; border-radius: 0 0 12px 12px; font: 13px/1.6 ui-monospace, Menlo, monospace; }
.xp-cmd input { flex: 1; background: none !important; border: 0 !important; outline: none; color: inherit; font: inherit; padding: 0 0 0 4px !important; }
.xp-sep { width: 1px; align-self: stretch; background: var(--vp-c-divider); }
.xp input, .xp textarea, .xp select { background: var(--vp-c-bg-soft); color: var(--vp-c-text-1); border: 1px solid var(--vp-c-divider); border-radius: 8px; padding: 6px 8px; font: inherit; }
.xp button { background: var(--vp-c-bg-soft); color: var(--vp-c-text-1); border: 1px solid var(--vp-c-divider); border-radius: 8px; padding: 5px 10px; cursor: pointer; font-size: 13px; }
.xp button.on { border-color: #facc15; }
.xp-actions { display: flex; flex-wrap: wrap; gap: 6px; }
</style>
