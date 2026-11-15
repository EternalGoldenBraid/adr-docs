<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { withBase, useRouter } from 'vitepress'

// Full-screen, one-node-at-a-time view of a graph. Solid edges are the story (next),
// dashed edges lead deeper into a topic under the current story node.
const props = defineProps({ nodes: { type: Array, required: true }, edges: { type: Array, required: true } })
const emit = defineEmits(['close'])
const router = useRouter()
const root = ref(null)
const embed = ref(false)

const byId = computed(() => new Map(props.nodes.map(n => [n.id, n])))
const out = (dashed) => {
  const next = new Map(), prev = new Map()
  for (const e of props.edges) {
    if (!!e.dashed !== dashed || !byId.value.has(e.source) || !byId.value.has(e.target)) continue
    if (!next.has(e.source)) next.set(e.source, e.target)
    if (!prev.has(e.target)) prev.set(e.target, e.source)
  }
  return { next, prev }
}
const solid = computed(() => out(false))
const dashed = computed(() => out(true))

// A node can only be reached by a dashed edge if it is part of a drill-down chain.
const anchor = id => {
  const seen = new Set()
  while (dashed.value.prev.has(id) && !seen.has(id)) { seen.add(id); id = dashed.value.prev.get(id) }
  return id
}
const story = computed(() => {
  const hasIncoming = new Set(props.edges.filter(e => byId.value.has(e.source) && byId.value.has(e.target)).map(e => e.target))
  const first = props.nodes.find(n => !hasIncoming.has(n.id)) || props.nodes[0]
  const list = [], seen = new Set()
  for (let id = first?.id; id && !seen.has(id); id = solid.value.next.get(id)) { seen.add(id); list.push(id) }
  return list
})
const chain = id => {
  const list = [], seen = new Set([id])
  for (let n = dashed.value.next.get(id); n && !seen.has(n); n = dashed.value.next.get(n)) { seen.add(n); list.push(n) }
  return list
}

const current = ref(story.value[0] || '')
const node = computed(() => byId.value.get(current.value))
const storyIndex = computed(() => story.value.indexOf(anchor(current.value)))
const depth = computed(() => { let d = 0, id = current.value; while (dashed.value.prev.has(id) && d < 99) { d++; id = dashed.value.prev.get(id) } return d })
const notice = ref('')
let noticeTimer
const say = text => { notice.value = text; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { notice.value = '' }, 1500) }

const go = id => { if (id && byId.value.has(id)) { current.value = id; embed.value = false } }
const step = d => { const id = story.value[storyIndex.value + d]; id ? go(id) : say(d > 0 ? 'End of the story' : 'Start of the story') }
const down = () => { const id = dashed.value.next.get(current.value); id ? go(id) : say(dashed.value.prev.has(current.value) ? 'End of this branch' : 'Nothing deeper here') }
const up = () => { const id = dashed.value.prev.get(current.value); id ? go(id) : say('Already on the story line') }

const imageSrc = u => !u ? '' : /^(https?:|data:|blob:)/.test(u) ? u : withBase(u)
const isExternal = link => /^[a-z][a-z\d+.-]*:/i.test(link)
const linkUrl = computed(() => { const l = node.value?.link; return !l ? '' : isExternal(l) ? l : withBase(l) })
function toggleEmbed() {
  if (!node.value?.link) return say('No link on this node')
  if (isExternal(node.value.link)) window.open(node.value.link, '_blank', 'noopener')
  else embed.value = !embed.value
}
function openPage() {
  const l = node.value?.link
  if (!l) return say('No link on this node')
  isExternal(l) ? (location.href = l) : router.go(withBase(l))
  emit('close')
}

// Minimap: story nodes in a row, each drill-down chain hanging beneath its story node.
const map = computed(() => {
  const dots = []
  story.value.forEach((id, col) => {
    dots.push({ id, col, row: 0 })
    chain(id).forEach((c, i) => dots.push({ id: c, col, row: i + 1 }))
  })
  return { dots, cols: story.value.length, rows: Math.max(1, ...dots.map(d => d.row + 1)) }
})

let lastG = 0
const keys = {
  ArrowRight: () => step(1), l: () => step(1),
  ArrowLeft: () => step(-1), h: () => step(-1),
  ArrowDown: down, j: down, ArrowUp: up, k: up,
  G: () => go(story.value[story.value.length - 1]),
  g: () => { if (lastG && Date.now() - lastG < 700) { lastG = 0; go(story.value[0]) } else lastG = Date.now() },
  Enter: toggleEmbed, e: toggleEmbed, o: openPage,
}
function onKey(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if (e.key === 'Escape') {
    if (embed.value) embed.value = false
    else close()
  } else if (keys[e.key]) keys[e.key]()
  e.preventDefault(); e.stopImmediatePropagation()
}
function close() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  emit('close')
}
const onFullscreen = () => { if (!document.fullscreenElement) emit('close') }

onMounted(() => {
  window.addEventListener('keydown', onKey, true)
  document.addEventListener('fullscreenchange', onFullscreen)
  root.value?.requestFullscreen?.().catch(() => {})
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey, true)
  document.removeEventListener('fullscreenchange', onFullscreen)
  clearTimeout(noticeTimer)
})
</script>

<template>
<Teleport to="body">
  <div ref="root" class="gp" role="dialog" aria-label="Presentation">
    <div class="gp-top">
      <span>{{ storyIndex + 1 }} / {{ story.length }}<template v-if="depth"> · deeper {{ depth }}</template></span>
      <span class="gp-notice">{{ notice }}</span>
      <button type="button" aria-label="Exit presentation" @click="close">✕ Esc</button>
    </div>
    <div v-if="node" class="gp-stage" :class="{ split: embed }">
      <article class="gp-card" :class="{ deep: depth > 0, image: node.image }">
        <div class="gp-text">
          <h1>{{ node.title }}</h1>
          <p v-if="node.body" class="gp-body">{{ node.body }}</p>
          <button v-if="node.link" type="button" class="gp-link" @click="toggleEmbed">
            ↗ {{ node.link }} <small>{{ embed ? 'Enter: hide preview' : 'Enter: preview' }} · o: open page</small>
          </button>
        </div>
        <img v-if="node.image" :src="imageSrc(node.image)" alt="" />
      </article>
      <iframe v-if="embed && linkUrl" class="gp-frame" :src="linkUrl" title="Linked page" />
    </div>
    <nav class="gp-map" :style="{ '--cols': map.cols, '--rows': map.rows }" aria-label="Position">
      <button v-for="d in map.dots" :key="d.id" type="button" class="gp-dot"
        :class="{ now: d.id === current, deep: d.row > 0 }"
        :style="{ gridColumn: d.col + 1, gridRow: d.row + 1 }" :title="byId.get(d.id)?.title" @click="go(d.id)" />
    </nav>
    <div class="gp-hint">← → story · ↓ deeper · ↑ back · Enter preview link · o open page · gg/G first/last · Esc exit</div>
  </div>
</Teleport>
</template>

<style>
.gp { position: fixed; inset: 0; z-index: 2147483000; display: flex; flex-direction: column; background: #0b1220; color: #e2e8f0; font-family: system-ui, sans-serif; }
.gp-top { display: flex; align-items: center; gap: 16px; padding: 14px 24px; color: #94a3b8; font-size: 16px; }
.gp-notice { flex: 1; color: #facc15; }
.gp button { font: inherit; cursor: pointer; }
.gp-top button { background: none; color: #94a3b8; border: 1px solid #334155; border-radius: 8px; padding: 4px 12px; }
.gp-stage { flex: 1; min-height: 0; display: flex; gap: 24px; padding: 0 48px; }
.gp-stage.split .gp-card { flex: 0 0 34%; }
.gp-card { flex: 1; min-width: 0; display: flex; align-items: center; justify-content: center; gap: 48px; overflow: auto; }
.gp-card.deep h1 { color: #93c5fd; }
.gp-text { max-width: 1000px; }
.gp-card.image .gp-text { flex: 1; }
.gp-card h1 { margin: 0 0 24px; font-size: clamp(32px, 5vw, 76px); line-height: 1.1; font-weight: 700; border: 0; padding: 0; letter-spacing: 0; }
.gp-body { margin: 0; font-size: clamp(20px, 2.6vw, 40px); line-height: 1.4; white-space: pre-line; color: #cbd5e1; }
.gp-card img { max-width: 48%; max-height: 100%; object-fit: contain; border-radius: 10px; }
.gp-stage.split .gp-card img { max-width: 100%; max-height: 30vh; }
.gp-stage.split .gp-card { flex-direction: column; gap: 20px; }
.gp-link { margin-top: 32px; display: inline-flex; flex-direction: column; align-items: flex-start; gap: 2px; background: #1e293b; color: #7dd3fc; border: 1px solid #334155; border-radius: 10px; padding: 10px 18px; font-size: 22px; }
.gp-link small { color: #64748b; font-size: 14px; }
.gp-frame { flex: 1; min-width: 0; border: 1px solid #334155; border-radius: 10px; background: #fff; margin-bottom: 8px; }
.gp-map { display: grid; grid-template-columns: repeat(var(--cols), 28px); grid-template-rows: repeat(var(--rows), 22px); gap: 4px 10px; justify-content: center; padding: 12px 24px 4px; }
.gp-dot { width: 14px; height: 14px; margin: auto; padding: 0; border-radius: 50%; background: #475569; border: 0; }
.gp-dot.deep { background: #1e3a5f; }
.gp-dot.now { background: #facc15; box-shadow: 0 0 0 4px #facc1544; }
.gp-hint { padding: 4px 24px 14px; text-align: center; color: #64748b; font-size: 14px; }
</style>
