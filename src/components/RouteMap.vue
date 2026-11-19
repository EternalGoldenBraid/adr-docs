<script setup>
import { computed, onMounted, ref } from 'vue'
import { withBase } from 'vitepress'

// <RouteMap src="/data/routes.json" /> – a top-down map with switchable layers: ground image, routes,
// recordings (click to open), datasets (colour by training or validation role). See docs/preview-comments.md.
const props = defineProps({
  src: { type: String, required: true },
  height: { type: Number, default: 560 },
})

const data = ref(null)
const error = ref('')
const on = ref({ routes: true, recordings: true, datasets: false })
const view = ref({ x: 0, y: 0, k: 1 })
const tip = ref(null)
const svg = ref(null)
let drag = null

const ROLE = { train: '#4dabf7', val: '#ff922b', test: '#da77f2' }
const DRIVER = { teacher: '#51cf66', student: '#ff6b6b' }
const withBaseUrl = u => (/^(https?:)?\/\//.test(u) ? u : withBase(u))

onMounted(async () => {
  try {
    const r = await fetch(withBaseUrl(props.src))
    if (!r.ok) throw new Error(`${props.src}: ${r.status}`)
    data.value = await r.json()
  } catch (e) { error.value = String(e.message || e) }
})

// World metres to image pixels. Image up is world +x, image right is world -y; the world origin is at `origin` (pixels, default the image centre).
const size = computed(() => data.value?.size ?? [860, 860])
const mpp = computed(() => data.value?.metersPerPixel ?? 1)
const origin = computed(() => data.value?.origin ?? [size.value[0] / 2, size.value[1] / 2])
const px = ([x, y]) => `${(origin.value[0] - y / mpp.value).toFixed(1)},${(origin.value[1] - x / mpp.value).toFixed(1)}`
const line = pts => pts.map(px).join(' ')

const routes = computed(() => (data.value?.routes ?? []).map(r => ({ ...r, pts: line(r.points) })))
const recordings = computed(() => (data.value?.recordings ?? []).map(r => ({ ...r, pts: line(r.points) })))

function colour(rec) {
  if (on.value.datasets && rec.role) return ROLE[rec.role] ?? '#adb5bd'
  return DRIVER[rec.driver] ?? '#adb5bd'
}
const legend = computed(() => on.value.datasets
  ? [['train', ROLE.train], ['validation', ROLE.val], ['test', ROLE.test]]
  : [['teacher', DRIVER.teacher], ['student', DRIVER.student]])

const box = computed(() => {
  const [w, h] = size.value
  return `${view.value.x} ${view.value.y} ${w / view.value.k} ${h / view.value.k}`
})

function toWorld(e) {
  const r = svg.value.getBoundingClientRect()
  const [w, h] = size.value
  const s = Math.min(r.width / w, r.height / h) * view.value.k
  return { x: view.value.x + (e.clientX - r.left) / s, y: view.value.y + (e.clientY - r.top) / s, s }
}
function wheel(e) {
  const p = toWorld(e)
  const k = Math.min(20, Math.max(1, view.value.k * (e.deltaY < 0 ? 1.25 : 0.8)))
  const [w, h] = size.value
  const r = svg.value.getBoundingClientRect()
  const s = Math.min(r.width / w, r.height / h) * k
  view.value = { k, x: clamp(p.x - (e.clientX - r.left) / s, 0, w - w / k), y: clamp(p.y - (e.clientY - r.top) / s, 0, h - h / k) }
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
function down(e) { drag = { sx: e.clientX, sy: e.clientY, x: view.value.x, y: view.value.y, moved: false }; svg.value.setPointerCapture(e.pointerId) }
function move(e) {
  if (!drag) return
  const p = toWorld(e)
  const dx = (e.clientX - drag.sx) / p.s, dy = (e.clientY - drag.sy) / p.s
  if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 3) drag.moved = true
  const [w, h] = size.value
  view.value = { ...view.value, x: clamp(drag.x - dx, 0, w - w / view.value.k), y: clamp(drag.y - dy, 0, h - h / view.value.k) }
}
function up() { drag = null }
function open(rec) {
  if (!drag?.moved && rec.url) window.open(withBaseUrl(rec.url), '_blank', 'noopener')
}
function reset() { view.value = { x: 0, y: 0, k: 1 } }
function hover(e, text) {
  const r = svg.value.getBoundingClientRect()
  tip.value = text ? { x: e.clientX - r.left + 12, y: e.clientY - r.top + 12, text } : null
}
const recText = r => [r.name ?? r.id, r.driver, r.role && `${r.role}`, r.route && `route ${r.route}`].filter(Boolean).join(' · ')
</script>

<template>
  <div class="route-map" :style="{ height: `${height}px` }">
    <p v-if="error" class="rm-err">Map data not loaded: {{ error }}</p>
    <template v-else-if="data">
      <div class="rm-bar">
        <label><input type="checkbox" v-model="on.routes" /> Routes</label>
        <label><input type="checkbox" v-model="on.recordings" /> Recordings</label>
        <label><input type="checkbox" v-model="on.datasets" /> Datasets</label>
        <span class="rm-legend"><i v-for="[n, c] in legend" :key="n"><b :style="{ background: c }"></b>{{ n }}</i></span>
        <button @click="reset" v-if="view.k > 1">reset view</button>
      </div>
      <svg ref="svg" :viewBox="box" preserveAspectRatio="xMidYMid meet" @wheel.prevent="wheel" @pointerdown="down" @pointermove="move" @pointerup="up">
        <image v-if="data.image" :href="withBaseUrl(data.image)" x="0" y="0" :width="size[0]" :height="size[1]" />
        <rect v-else x="0" y="0" :width="size[0]" :height="size[1]" class="rm-ground" />
        <g v-if="on.routes" class="rm-routes">
          <polyline v-for="r in routes" :key="r.id" :points="r.pts" @pointermove="hover($event, `${r.name ?? r.id}${r.seeds ? ' · seeds ' + r.seeds.join(', ') : ''}`)" @pointerleave="hover($event, '')" />
        </g>
        <g v-if="on.recordings" class="rm-recs">
          <polyline v-for="r in recordings" :key="r.id" :points="r.pts" :stroke="colour(r)" :class="{ link: r.url }"
            @click="open(r)" @pointermove="hover($event, recText(r))" @pointerleave="hover($event, '')" />
        </g>
      </svg>
      <div v-if="tip" class="rm-tip" :style="{ left: `${tip.x}px`, top: `${tip.y}px` }">{{ tip.text }}</div>
    </template>
    <p v-else class="rm-err">Loading map…</p>
  </div>
</template>

<style scoped>
.route-map { position: relative; width: 100%; margin: 16px 0; border: 1px solid var(--vp-c-divider); border-radius: 8px; overflow: hidden; background: #0d1117; display: flex; flex-direction: column }
.rm-bar { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; padding: 6px 12px; font-size: 13px; border-bottom: 1px solid var(--vp-c-divider); background: var(--vp-c-bg-soft) }
.rm-bar label { cursor: pointer }
.rm-legend { margin-left: auto; display: flex; gap: 10px }
.rm-legend i { font-style: normal; display: inline-flex; align-items: center; gap: 4px }
.rm-legend b { width: 12px; height: 4px; border-radius: 2px; display: inline-block }
.rm-bar button { font-size: 12px; padding: 1px 8px; border: 1px solid var(--vp-c-divider); border-radius: 4px; background: transparent; color: inherit; cursor: pointer }
svg { flex: 1; min-height: 0; width: 100%; touch-action: none; cursor: grab; background: #1b2230 }
svg:active { cursor: grabbing }
.rm-ground { fill: #1b2230 }
.rm-routes polyline { fill: none; stroke: #fff; stroke-opacity: .55; stroke-width: 6; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke }
.rm-recs polyline { fill: none; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; opacity: .95 }
.rm-recs polyline.link { cursor: pointer }
.rm-recs polyline:hover { stroke-width: 5 }
.rm-tip { position: absolute; pointer-events: none; padding: 3px 8px; border-radius: 4px; font-size: 12px; background: rgba(0, 0, 0, .8); color: #fff; white-space: nowrap }
.rm-err { padding: 16px; color: var(--vp-c-text-2) }
</style>
