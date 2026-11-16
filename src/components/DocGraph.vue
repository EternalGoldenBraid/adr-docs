<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import cytoscape from 'cytoscape'
import { withBase, useRouter } from 'vitepress'
import GraphPresenter from './GraphPresenter.vue'

// src: URL of the graph JSON (served from the document's public/ folder).
// Local edits are autosaved in the browser under storageKey.
const props = defineProps({ src: { type: String, required: true }, storageKey: { type: String, default: '' }, title: { type: String, default: 'Graph' }, height: { type: String, default: '' },
  // Optional tabs: [{ label, topic, lane }]; defaults to one tab per topic in the data
  tabs: { type: Array, default: () => [] },
  // Optional link back to the parent page, e.g. back="/" back-label="Plan"
  backTo: { type: String, default: '' }, backLabel: { type: String, default: 'Back' } })
const router = useRouter()
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
// The page owns the keys until the graph is clicked; Esc in normal mode hands them back.
const active = ref(false)
const uid = Math.random().toString(36).slice(2)
const main = ref(null)
const vimOn = ref(typeof localStorage === 'undefined' || localStorage.getItem('preview-comments-vim') !== 'off')
const cmd = ref(null)
const cmdInput = ref(null)
const flash = ref('')
const presenting = ref(null)
const selTitle = computed(() => (selected.value && cy ? cy.getElementById(selected.value).data('title') || '' : ''))
const HELP = "DOC-GRAPH(1)\n\nLAYERS\n  The page owns the keys. Click the graph to enter it\n  (mode line: GRAPH); Esc in NORMAL returns to the page.\nMODES\n  NORMAL  fly the view         VISUAL  walk node to node\n  INSERT  edit the graph       Esc     back to NORMAL\nNORMAL\n  h j k l   pan (H J K L: faster)\n  + - 0     zoom in / out / fit\n  v  visual     i  insert     u  up one layer\n  Enter     open the selected \u25b8 layer or \u2197 page\nVISUAL\n  h j k l   nearest node in that direction\n  Enter     open \u25b8 layer or \u2197 page, else zoom to node\n  c         comment on the node\n  s         attach a region screenshot\nINSERT\n  h j k l   select neighbour\n  arrows    nudge node (shift: x5)\n  Enter     edit text    o  new node    x  delete\nCOMMANDS\n  :help :man   this page     :w  export JSON\n  :fit         fit all       :q  close\n  :present     full-screen presentation (→ ← story, ↓ ↑ deeper, Esc exits)\nMOUSE / TRACKPAD\n  swipe pans \u00b7 pinch or shift+swipe zooms\n  dbl-click: \u2197 opens page, \u25b8 opens layer,\n    node/lane zooms, empty fits\nLINKS\n  a node with a \"link\" (e.g. \"/autonomy\") shows \u2197;\n  external URLs open as normal links"
const topic = ref('')
const activeTab = ref('')
const TOPICS = ref([])
let cy = null
let ro = null
let landOnNode = () => {}
let moved = false

const SHOW_BODY_ZOOM = 0.55
const labelHost = ref(null)
const labelEls = new Map()
let labelFrame = 0

const SHAPES = new Set(['round-rectangle', 'rectangle', 'ellipse', 'diamond', 'hexagon', 'octagon', 'round-tag', 'barrel'])
const imageSrc = u => !u ? '' : /^(https?:|data:|blob:|\.\/)/.test(u) ? u : withBase(u)

function nodeLabel(n) {
  return n.data('kind') === 'node' ? '' : (n.data('title') || '') + (n.data('status') ? '  ' + n.data('status') : '') + (n.data('badge') || '')
}

// Nodes show a bold title over a regular body, which canvas labels cannot mix.
function drawLabels() {
  labelFrame = 0
  if (!cy || !labelHost.value) return
  const z = cy.zoom()
  const live = new Set()
  cy.nodes('[kind = "node"]').forEach(n => {
    if (n.style('display') === 'none') return
    live.add(n.id())
    let el = labelEls.get(n.id())
    if (!el) {
      el = document.createElement('div')
      el.className = 'xp-label'
      el.innerHTML = '<img alt=""><b></b><span></span>'
      labelHost.value.appendChild(el)
      labelEls.set(n.id(), el)
    }
    const d = n.data(), p = n.renderedPosition()
    const lines = Math.max(0, Math.floor((d.h - 38) / 14))
    el.style.cssText = `left:${p.x - d.w * z / 2}px;top:${p.y - d.h * z / 2}px;width:${d.w * z}px;height:${d.h * z}px;` +
      `font-size:${13 * z}px;color:${d.font};opacity:${n.style('opacity')};padding:${6 * z}px ${8 * z}px`
    const img = el.firstChild
    const src = imageSrc(d.image)
    if (img.dataset.src !== src) { img.dataset.src = src; if (src) img.src = src; else img.removeAttribute('src') }
    img.style.display = src ? 'block' : 'none'
    if (d.shape === 'ellipse') el.style.borderRadius = '50%'
    el.children[1].textContent = (d.title || '') + (d.status ? '  ' + d.status : '') + (d.badge || '')
    const body = el.lastChild
    if (src) img.style.maxHeight = `${Math.max(0, d.h - 34) * z}px`
    body.textContent = d.body || ''
    body.style.display = d.body && z >= SHOW_BODY_ZOOM && lines > 0 ? '-webkit-box' : 'none'
    body.style.webkitLineClamp = String(lines)
  })
  for (const [id, el] of labelEls) if (!live.has(id)) { el.remove(); labelEls.delete(id) }
}
// Whole graph as a large PNG for figures: the canvas (edges, groups) plus the HTML node labels, which cy.png() cannot see.
async function exportPng(scale = 3) {
  const dark = document.documentElement.classList.contains('dark')
  const box = cy.elements().boundingBox()
  const base = await createImageBitmap(cy.png({ output: 'blob', full: true, scale, bg: dark ? '#1b1b1f' : '#ffffff' }))
  const canvas = document.createElement('canvas')
  canvas.width = base.width; canvas.height = base.height
  const g = canvas.getContext('2d')
  g.drawImage(base, 0, 0)
  const wrap = (text, width) => {
    const out = []
    for (const para of String(text).split('\n')) {
      let line = ''
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = line ? line + ' ' + word : word
        if (line && g.measureText(next).width > width) { out.push(line); line = word } else line = next
      }
      out.push(line)
    }
    return out
  }
  g.textAlign = 'center'; g.textBaseline = 'top'
  cy.nodes('[kind = "node"]').forEach(n => {
    if (n.style('display') === 'none') return
    const d = n.data(), p = n.position()
    const cx = (p.x - box.x1) * scale, top = (p.y - d.h / 2 - box.y1) * scale, width = (d.w - 16) * scale, line = 13 * 1.25 * scale
    g.fillStyle = d.font
    g.font = `700 ${13 * scale}px sans-serif`
    const title = wrap((d.title || '') + (d.status ? '  ' + d.status : '') + (d.badge || ''), width)
    g.font = `400 ${12 * scale}px sans-serif`
    const body = d.body ? wrap(d.body, width) : []
    const maxLines = Math.max(1, Math.floor((d.h - 12) / 16.25))
    const rows = [...title.map(t => ({ t, bold: true })), ...body.map(t => ({ t }))].slice(0, maxLines)
    let y = top + Math.max(6 * scale, (d.h * scale - rows.length * line) / 2)
    for (const r of rows) { g.font = `${r.bold ? 700 : 400} ${(r.bold ? 13 : 12) * scale}px sans-serif`; g.fillText(r.t, cx, y); y += line }
  })
  return new Promise(done => canvas.toBlob(done, 'image/png'))
}
const scheduleLabels = () => { if (!labelFrame) labelFrame = requestAnimationFrame(drawLabels) }

function nodeEl(n) {
  const d = { id: n.id, title: n.title, body: n.body, status: n.status, kind: n.kind, topics: n.topics, link: n.link || '',
    w: n.w, h: n.h, fill: n.fill, stroke: n.stroke, font: n.font }
  if (n.image) d.image = n.image
  if (n.video) d.video = n.video
  if (SHAPES.has(n.shape)) d.shape = n.shape
  if (n.parent) d.parent = n.parent
  if (n.inside) d.inside = n.inside
  return { group: 'nodes', data: d, position: { x: n.x, y: n.y } }
}

function edgeEl(e) {
  return { group: 'edges', data: { id: e.id, source: e.source, target: e.target, color: e.color, dashed: e.dashed, label: e.label || '', ...(e.loop != null ? { loop: e.loop } : {}) } }
}

// Edges meeting the same side of a node get their own attachment slot, ordered by where the other end
// lies so lines do not cross; edges between the same pair keep one order at both ends, so they run side by side.
function spreadEdges() {
  const slots = new Map()
  const place = (edge, own, other) => {
    const o = own.position(), p = other.position()
    const horizontal = Math.abs(p.y - o.y) * 2 < (own.data('h') + other.data('h')) // vertical ranges overlap
    const side = horizontal ? (p.x > o.x ? 'right' : 'left') : (p.y > o.y ? 'bottom' : 'top')
    const key = own.id() + side
    if (!slots.has(key)) slots.set(key, { own, side, items: [] })
    slots.get(key).items.push({ edge, along: horizontal ? p.y : p.x, end: own === edge.source() ? 'sep' : 'tep' })
  }
  cy.batch(() => {
    cy.edges().forEach(e => {
      if (e.style('display') === 'none' || e.source() === e.target()) return
      place(e, e.source(), e.target())
      place(e, e.target(), e.source())
    })
    for (const { own, side, items } of slots.values()) {
      items.sort((a, b) => a.along - b.along || (a.edge.id() < b.edge.id() ? -1 : 1))
      const w = own.data('w'), h = own.data('h'), vertical = side === 'left' || side === 'right'
      const span = (vertical ? h : w) * 0.8
      items.forEach((item, i) => {
        const offset = Math.round((items.length === 1 ? 0 : (i / (items.length - 1) - 0.5) * span))
        const at = side === 'top' ? `${offset}px ${-h / 2}px` : side === 'bottom' ? `${offset}px ${h / 2}px`
          : side === 'left' ? `${-w / 2}px ${offset}px` : `${w / 2}px ${offset}px`
        item.edge.data(item.end, at)
        item.edge.scratch(item.end, { x: own.position('x') + parseFloat(at.split(' ')[0]), y: own.position('y') + parseFloat(at.split(' ')[1]), side })
      })
    }
    // Explicit elbows (taxi bends toward node centres once endpoints move): vertical-horizontal-vertical, or horizontal-vertical-horizontal.
    cy.edges().forEach(e => {
      const a = e.scratch('sep'), b = e.scratch('tep')
      if (!a || !b || e.style('display') === 'none') return
      const c = e.source().position(), t = e.target().position()
      const dx = t.x - c.x, dy = t.y - c.y, len = Math.hypot(dx, dy)
      const sideways = a.side === 'left' || a.side === 'right'
      const bends = sideways
        ? (Math.abs(b.y - a.y) < 1 ? [] : [{ x: (a.x + b.x) / 2, y: a.y }, { x: (a.x + b.x) / 2, y: b.y }])
        : (Math.abs(b.x - a.x) < 1 ? [] : [{ x: a.x, y: (a.y + b.y) / 2 }, { x: b.x, y: (a.y + b.y) / 2 }])
      if (!bends.length || !len) { e.removeData('route'); return }
      e.data('route', {
        weights: bends.map(q => ((q.x - c.x) * dx + (q.y - c.y) * dy) / (len * len)),
        distances: bends.map(q => ((q.y - c.y) * dx - (q.x - c.x) * dy) / len),
      })
    })
  })
}

function serialise() {
  return {
    nodes: cy.nodes().map(n => {
      const d = n.data()
      return { id: d.id, title: d.title, body: d.body, status: d.status, kind: d.kind, parent: d.parent || null, inside: d.inside || null,
        x: Math.round(n.position('x')), y: Math.round(n.position('y')), w: d.w, h: d.h,
        fill: d.fill, stroke: d.stroke, font: d.font, topics: d.topics, ...(d.link ? { link: d.link } : {}), ...(d.image ? { image: d.image } : {}), ...(d.video ? { video: d.video } : {}), ...(d.shape ? { shape: d.shape } : {}) }
    }),
    edges: cy.edges().map(e => ({ id: e.id(), source: e.data('source'), target: e.data('target'),
      color: e.data('color'), dashed: !!e.data('dashed'), label: e.data('label') || '', ...(e.data('loop') != null ? { loop: e.data('loop') } : {}) })),
  }
}

const save = () => localStorage.setItem(STORE, JSON.stringify(serialise()))

const layer = ref(null)
const layerTitle = ref('')

const childrenOf = id => cy.nodes().filter(n => n.data('inside') === id)

function showBadges() {
  cy.nodes().forEach(n => {
    const k = childrenOf(n.id()).length
    n.data('badge', (k ? `  ▸ ${k}` : '') + (n.data('link') ? '  ↗' : ''))
  })
}

function showLayer(id) {
  layer.value = id
  layerTitle.value = id ? cy.getElementById(id).data('title') : ''
  const visible = cy.nodes().filter(n => (n.data('inside') || null) === id && (n.data('kind') !== 'lane' || !id))
  cy.batch(() => {
    cy.elements().style('display', 'none')
    visible.style('display', 'element')
    visible.edgesWith(visible).style('display', 'element')
  })
  showBadges()
  spreadEdges()
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
  editor.value = { title: n.data('title') || '', body: n.data('body') || '', status: n.data('status') || '', link: n.data('link') || '' }
  nextTick(() => titleInput.value && titleInput.value.focus())
}

function commitEdit() {
  if (!editor.value) return
  const n = cy.getElementById(selected.value)
  if (n.length) n.data({ title: editor.value.title, body: editor.value.body, status: editor.value.status, link: editor.value.link.trim() })
  showBadges()
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

function openLink(n) {
  const link = n.data('link')
  if (!link) return false
  if (/^[a-z][a-z\d+.-]*:/i.test(link)) location.href = link
  else router.go(withBase(link))
  return true
}
const hasLink = () => Boolean(selected.value && cy.getElementById(selected.value).data('link'))
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

const tabList = computed(() => props.tabs.length ? props.tabs : TOPICS.value.map(t => ({ label: t, topic: t })))

function pickTab(t) {
  activeTab.value = t ? t.label : ''
  topic.value = t ? t.topic : ''
  if (layer.value) showLayer(null)
  applyTopic()
  const lane = t && t.lane ? cy.getElementById(t.lane) : null
  if (lane && lane.nonempty()) cy.animate({ fit: { eles: lane, padding: 60 }, duration: 300 })
  else fitAll()
}

function announce() {
  document.dispatchEvent(new CustomEvent('preview-comment-mode', { detail: { mode: active.value ? 'GRAPH · ' + mode.value.toUpperCase() : null } }))
}
function activate() {
  if (active.value) return
  active.value = true
  document.dispatchEvent(new CustomEvent('adr-graph-active', { detail: { uid } }))
  announce()
}
function deactivate() {
  if (!active.value) return
  active.value = false
  help.value = false
  cmd.value = null
  announce()
}
const onOther = e => { if (e.detail.uid !== uid) deactivate() }
const onOutside = e => { if (!e.composedPath().includes(main.value)) deactivate() }

function setMode(m) {
  mode.value = m
  const on = m === 'insert'
  editMode.value = on
  cy.autoungrabify(!on)
  if (!on) { editor.value = null; connecting.value = false }
  announce()
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
  if (!data) data = await (await fetch(withBase(props.src))).json()

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
      { selector: 'node[shape]', style: { shape: 'data(shape)' } },
      { selector: ':parent', style: {
        'text-valign': 'top', 'text-halign': 'center', 'text-margin-y': -8, padding: 34,
        'compound-sizing-wrt-labels': 'exclude', 'background-opacity': 0.12, 'border-width': 2, 'font-size': 15,
        'text-background-color': 'data(stroke)', 'text-background-opacity': 1, 'text-background-padding': 7,
        'text-background-shape': 'round-rectangle', color: '#0b1220' } },
      { selector: 'node[kind = "text"]', style: { 'background-opacity': 0, 'border-width': 0, 'text-margin-x': n => -n.data('w') / 2 + (n.data('title') || '').length * 3.4 + 4, 'font-size': 12, 'font-weight': 500 } },
      { selector: 'edge', style: {
        width: 2, 'line-color': 'data(color)', 'target-arrow-color': 'data(color)', 'target-arrow-shape': 'triangle',
        'curve-style': 'taxi', 'taxi-direction': 'vertical', 'taxi-turn': '50%', 'taxi-radius': 8, opacity: 0.85 } },
      { selector: 'edge:loop', style: { 'curve-style': 'bezier', 'loop-direction': '-90deg', 'loop-sweep': '-60deg', 'control-point-step-size': 90 } },
      ...['top', 'right', 'bottom'].map((side, i) => ({ selector: `edge:loop[loop = "${side}"]`, style: { 'loop-direction': `${i * 90}deg` } })),
      { selector: 'edge[sep]', style: { 'source-endpoint': 'data(sep)', 'target-endpoint': 'data(tep)' } },
      { selector: 'edge[sep][!route]', style: { 'curve-style': 'straight' } },
      { selector: 'edge[route]', style: { 'curve-style': 'segments', 'segment-weights': e => e.data('route').weights, 'segment-distances': e => e.data('route').distances, 'edge-distances': 'node-position' } },
      { selector: 'node[kind = "dot"]', style: { label: '', 'border-width': 0 } },
      { selector: 'edge[label]', style: { label: 'data(label)', 'font-size': 14, 'font-weight': 600, color: 'data(color)', 'text-background-color': '#0b1220', 'text-background-opacity': 1, 'text-background-padding': 4, 'text-background-shape': 'round-rectangle' } },
      { selector: 'edge[?dashed]', style: { 'line-style': 'dashed' } },
      { selector: '.dim', style: { opacity: 0.12 } },
      { selector: '.flash', style: { 'border-color': '#facc15', 'border-width': 6, 'overlay-color': '#facc15', 'overlay-opacity': 0.25, 'overlay-padding': 8 } },
      { selector: ':selected', style: { 'border-color': '#facc15', 'border-width': 4 } },
    ],
    layout: { name: 'preset' },
  })

  // Same controls as the static graph: two-finger swipe pans, pinch (ctrl+wheel) zooms.
  host.value.addEventListener('wheel', e => {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) {
      // Some systems turn Shift+swipe into horizontal scroll, hence the deltaX fallback
      const dy = e.deltaY || e.deltaX
      const r = host.value.getBoundingClientRect()
      const model = cy.nodes().filter(n => n.style('display') !== 'none').boundingBox()
      const floor = Math.max(cy.minZoom(), 0.5 * Math.min((cy.width() - 80) / Math.max(model.w, 1), (cy.height() - 80) / Math.max(model.h, 1)))
      const level = Math.min(cy.maxZoom(), Math.max(floor, cy.zoom() * Math.exp(-dy * (e.ctrlKey || e.metaKey ? 0.01 : 0.006))))
      // At a zoom limit the gesture falls through to the browser instead of being swallowed
      if (level === cy.zoom()) return
      e.preventDefault()
      cy.zoom({ level, renderedPosition: { x: e.clientX - r.left, y: e.clientY - r.top } })
      return
    }
    // Keep some content in view; once panned to the edge, the page scrolls instead.
    const bb = cy.nodes().filter(n => n.style('display') !== 'none').renderedBoundingBox()
    const keep = 60
    const pan = cy.pan()
    const x = Math.min(Math.max(-e.deltaX, keep - bb.x2), cy.width() - keep - bb.x1)
    const y = Math.min(Math.max(-e.deltaY, keep - bb.y2), cy.height() - keep - bb.y1)
    const moves = (e.deltaX && Math.abs(x) > 0.5 && Math.sign(x) === Math.sign(-e.deltaX)) || (e.deltaY && Math.abs(y) > 0.5 && Math.sign(y) === Math.sign(-e.deltaY))
    if (!moves) return
    e.preventDefault()
    cy.pan({ x: pan.x + x, y: pan.y + y })
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


  showLayer(null)
  // Links like /page#node-<id> open the node's layer, centre it and flash it.
  landOnNode = () => {
    const m = decodeURIComponent(location.hash.slice(1)).match(/^node-(.+)$/)
    const n = m && cy.getElementById(m[1])
    if (!n || n.empty()) return
    const inside = n.data('inside') || null
    if (layer.value !== inside) showLayer(inside)
    select(n)
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
    cy.animate({ center: { eles: n }, zoom: Math.max(cy.zoom(), 1) }, { duration: calm ? 0 : 300 })
    moved = true
    n.addClass('flash')
    setTimeout(() => n.removeClass('flash'), 2000)
    host.value?.scrollIntoView({ block: 'center', behavior: calm ? 'auto' : 'smooth' })
  }
  landOnNode()
  addEventListener('hashchange', landOnNode)
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
    if (openLink(e.target)) return
    if (childrenOf(e.target.id()).length) showLayer(e.target.id())
    else if (editMode.value) { select(e.target); startEdit() }
    else cy.animate({ fit: { eles: e.target, padding: 120 }, duration: 250 })
  })
  cy.on('pan zoom drag', () => { editor.value = null })
  cy.on('dragfree', 'node', e => {
    const p = e.target.position()
    e.target.position({ x: Math.round(p.x / 10) * 10, y: Math.round(p.y / 10) * 10 })
    spreadEdges()
    save()
  })
  cy.on('render', scheduleLabels)
  host.value._adrExportPng = exportPng
  // Compact nodes (any kind but 'node') show only the title, so the body is the hover text.
  cy.on('mouseover', 'node', e => { if (e.target.data('kind') !== 'node' && e.target.data('kind') !== 'lane') host.value.title = e.target.data('body') || '' })
  cy.on('mouseout', 'node', () => { host.value.title = '' })
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

function present() {
  const nodes = cy.nodes().filter(n => !n.isParent() && !['text', 'dot'].includes(n.data('kind')))
    .map(n => ({ id: n.id(), title: n.data('title') || '', body: n.data('body') || '', link: n.data('link') || '', image: n.data('image') || '', video: n.data('video') || '' }))
  if (!nodes.length) return say('Nothing to present')
  const ids = new Set(nodes.map(n => n.id))
  const edges = cy.edges().map(e => ({ source: e.data('source'), target: e.data('target'), dashed: !!e.data('dashed') })).filter(e => ids.has(e.source) && ids.has(e.target))
  presenting.value = { nodes, edges }
}

function runCmd() {
  const c = (cmd.value || '').trim()
  cmd.value = null
  if (['help', 'h', 'man'].includes(c)) help.value = true
  else if (['q', 'close'].includes(c)) help.value = false
  else if (c === 'w') exportJson()
  else if (c === 'fit') fitAll()
  else if (['present', 'pres'].includes(c)) present()
  else if (c) say('E492: Not an editor command: ' + c)
}

function onKey(e) {
  if ((e.composedPath?.()[0] || e.target).matches?.('input,textarea,select') || e.ctrlKey || e.metaKey || e.altKey) return
  if (!active.value) return
  if (e.key === '?') { help.value = !help.value; return }
  if (!vimOn.value) return
  const k = e.key
  if (k === 'Escape') {
    if (help.value) { help.value = false; return }
    if (mode.value !== 'normal') setMode('normal')
    else deactivate()
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
    if (k === 'Enter' && hasLink()) { done(); openLink(sel()) }
    else if (k === 'Enter' && hasLayer()) { done(); openSelected() }
    return
  }
  if (mode.value === 'visual') {
    if (dirs[k]) { done(); const n = neighbour(...dirs[k]); if (n) selectNode(n); return }
    if (k === 'Enter' && selected.value) {
      done()
      if (hasLink()) openLink(sel())
      else if (hasLayer()) openSelected()
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
onMounted(() => {
  window.addEventListener('keydown', onKey)
  document.addEventListener('adr-graph-active', onOther)
  document.addEventListener('adr-present', present)
  document.addEventListener('pointerdown', onOutside, true)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  document.removeEventListener('adr-graph-active', onOther)
  document.removeEventListener('adr-present', present)
  document.removeEventListener('pointerdown', onOutside, true)
  deactivate()
})

onUnmounted(() => { removeEventListener('hashchange', landOnNode); document.removeEventListener('preview-comment-vim', onVim); delete window.previewCommentTargets; if (ro) ro.disconnect(); if (cy) cy.destroy() })
</script>

<template>
<div class="xp">
  <GraphPresenter v-if="presenting" :nodes="presenting.nodes" :edges="presenting.edges" @close="presenting = null" />
  <div class="xp-bar">
    <strong>{{ title }}</strong>
    <a v-if="backTo" class="xp-back" :href="withBase(backTo)">← {{ backLabel }}</a>
    <button v-if="layer" @click="back">← Back</button>
    <strong v-if="layer">{{ layerTitle }}</strong>
    <span v-if="tabList.length" class="xp-tabs">
      <button :class="{ on: !activeTab }" @click="pickTab(null)">All</button>
      <button v-for="t in tabList" :key="t.label" :class="{ on: activeTab === t.label }" @click="pickTab(t)">{{ t.label }}</button>
    </span>
    <button title="Present full screen (:present)" @click="present">▶ Present</button>
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
  <div ref="main" class="xp-main" :class="{ active }" @pointerdown="activate">
    <div class="xp-canvas" :style="height ? { height } : null"><div ref="host" class="xp-host"></div><div ref="labelHost" class="xp-labels"></div></div>
    <div class="xp-status"><span class="xp-mode" :data-mode="mode">{{ !active ? 'PAGE  (click graph for graph keys)' : vimOn ? 'GRAPH -- ' + mode.toUpperCase() + ' --' : mode.toUpperCase() }}</span>
      <span v-if="selected" class="xp-sel">{{ selTitle }}</span><span class="xp-flash">{{ flash }}</span><span class="xp-hint">:help</span></div>
    <div v-if="cmd !== null" class="xp-cmd">:<input ref="cmdInput" v-model="cmd" spellcheck="false" @keydown.enter="runCmd" @keydown.esc="cmd = null" @keydown.backspace="!cmd && (cmd = null)" /></div>
    <div v-if="help" class="xp-help"><pre v-text="HELP"></pre></div>
    <div v-if="editor" class="xp-edit" :style="{ left: editorBox.left + 'px', top: editorBox.top + 'px', width: editorBox.width + 'px' }"
      @keydown.esc="editor = null">
      <input ref="titleInput" v-model="editor.title" placeholder="Title" @keydown.enter="commitEdit" />
      <input v-model="editor.status" placeholder="Status, e.g. ● MVP" @keydown.enter="commitEdit" />
      <input v-model="editor.link" placeholder="Link, e.g. /autonomy" @keydown.enter="commitEdit" />
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
.xp-canvas { position: relative; flex: 1; min-width: 0; overflow: hidden; height: calc(100vh - 150px); border: 1px solid var(--vp-c-divider); border-radius: 12px; background: #0b1220; }
.xp-main { position: relative; }
.xp-host { position: absolute; inset: 0; }
.xp-labels { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.xp-label { position: absolute; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; overflow: hidden; line-height: 1.25; }
.xp-label img { flex: 0 1 auto; min-height: 0; max-width: 100%; object-fit: contain; border-radius: 4px; margin-bottom: 3px; }
.xp-label b { font-weight: 700; }
.xp-label span { white-space: pre-line; font-weight: 400; font-size: 0.92em; opacity: .9; overflow: hidden; -webkit-box-orient: vertical; }
.xp-back { font-size: 13px; text-decoration: none; padding: 5px 10px; border: 1px solid var(--vp-c-divider); border-radius: 8px; }
.xp-tabs { display: flex; flex-wrap: wrap; gap: 6px; }
.xp-tabs .on { background: var(--vp-c-brand-soft); border-color: var(--vp-c-brand-1); }
.xp-edit { position: absolute; z-index: 5; display: flex; flex-direction: column; gap: 6px; padding: 10px; background: var(--vp-c-bg); border: 1px solid var(--vp-c-divider); border-radius: 12px; box-shadow: 0 8px 28px #0009; font-size: 13px; }
.xp-help { position: absolute; right: 12px; bottom: 30px; z-index: 6; padding: 8px 14px; background: #0b1220; color: #cbd5e1; border: 1px solid #475569; border-radius: 4px; font: 12px/1.4 ui-monospace, 'JetBrains Mono', Menlo, monospace; pointer-events: none; }
.xp-help pre { margin: 6px 0 0; font: inherit; background: none; padding: 0; }
.xp-status { position: absolute; left: 0; right: 0; bottom: 0; z-index: 4; display: flex; gap: 14px; align-items: center; padding: 2px 170px 2px 10px; background: #111827; color: #cbd5e1; border-radius: 0 0 12px 12px; font: 12px/1.6 ui-monospace, Menlo, monospace; pointer-events: none; }
.xp-main:not(.active) .xp-mode { opacity: .5; font-weight: 400; }
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
