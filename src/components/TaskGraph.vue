<script setup>
import { computed } from 'vue'

// Queued tests as a dependency graph: one lane per agent, columns by dependency depth, arrows from `after` to the dependent test.
// A dependency that is not in the queues is taken as done.
const props = defineProps({ queues: { type: Object, default: () => ({}) } })
const COLOURS = { running: '#6fb7e8', failed: '#e5484d', blocked: '#f38ba8', planned: '#868e96' }
const clip = (text, n) => text.length > n ? text.slice(0, n - 1) + '…' : text
const W = 190, H = 40, GAP_X = 70, GAP_Y = 14, LANE_PAD = 10, LABEL = 170, ISO_COLS = 3

const graph = computed(() => {
  const tasks = []
  for (const [agent, items] of Object.entries(props.queues)) for (const t of items) tasks.push({ ...t, agent, key: `${t.page}#${t.id ?? t.test}` })
  const byKey = new Map(tasks.map(t => [t.key, t]))
  const find = (from, ref) => byKey.get(ref.includes('#') ? ref : `${from.page}#${ref}`) ?? tasks.find(t => t.id === ref)
  for (const t of tasks) t.deps = (t.after ?? []).map(ref => find(t, ref)).filter(Boolean)
  const depth = (t, trail = new Set()) => {
    if (t.depth !== undefined) return t.depth
    if (trail.has(t.key)) return 0
    trail.add(t.key)
    return t.depth = t.deps.length ? 1 + Math.max(...t.deps.map(d => depth(d, trail))) : 0
  }
  tasks.forEach(t => depth(t))
  const linked = new Set(tasks.flatMap(t => t.deps.length ? [t.key, ...t.deps.map(d => d.key)] : []))
  const lanes = []
  let y = 0
  for (const agent of Object.keys(props.queues)) {
    const own = tasks.filter(t => t.agent === agent).sort((a, b) => a.depth - b.depth || a.rank - b.rank)
    const rowsAt = new Map()
    let alone = 0
    for (const t of own) {
      if (!linked.has(t.key)) {
        t.x = LABEL + (alone % ISO_COLS) * (W + 12); t.y = y + LANE_PAD + Math.floor(alone / ISO_COLS) * (H + GAP_Y); alone++
        continue
      }
      const row = rowsAt.get(t.depth) ?? 0
      rowsAt.set(t.depth, row + 1)
      t.x = LABEL + ISO_COLS * (W + 12) + 20 + t.depth * (W + GAP_X); t.y = y + LANE_PAD + row * (H + GAP_Y)
    }
    const rows = Math.max(1, Math.ceil(alone / ISO_COLS), ...rowsAt.values())
    const height = LANE_PAD * 2 + rows * H + (rows - 1) * GAP_Y
    lanes.push({ agent, y, height, empty: !own.length })
    y += height
  }
  for (const t of tasks) {
    const open = t.deps.some(d => d.state !== 'done')
    t.shown = t.state === 'running' ? 'running' : t.state === 'failed' ? 'failed' : open ? 'blocked' : 'planned'
    t.colour = COLOURS[t.shown]
    t.label = clip(t.test, 28)
    t.sub = [t.weight ? `w${t.weight}` : '', t.shown === 'blocked' ? 'waits ' + t.deps.filter(d => d.state !== 'done').map(d => clip(d.test, 14)).join(', ') : t.shown].filter(Boolean).join(' · ')
  }
  const edges = tasks.flatMap(t => t.deps.map(d => ({ key: d.key + '>' + t.key, x1: d.x + W, y1: d.y + H / 2, x2: t.x, y2: t.y + H / 2 })))
  const width = Math.max(...tasks.map(t => t.x + W), LABEL + W) + 10
  return { tasks, lanes, edges, width, height: Math.max(y, 40) }
})
</script>

<template>
  <div v-if="Object.keys(queues).length" class="task-graph">
    <p class="tg-title">Queued tests: one lane per agent, independent tests are grouped on the left, arrows run from the test that must finish to the one that waits. Pink = blocked, blue = running, grey = ready.</p>
    <div class="tg-scroll">
      <svg :viewBox="`0 0 ${graph.width} ${graph.height}`" :width="graph.width" :height="graph.height">
        <defs><marker id="tg-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill="#adb5bd" /></marker></defs>
        <g v-for="l in graph.lanes" :key="l.agent">
          <rect x="0" :y="l.y" :width="graph.width" :height="l.height" class="lane" />
          <text x="8" :y="l.y + l.height / 2" class="lane-name">{{ l.agent }}</text>
          <text v-if="l.empty" :x="LABEL" :y="l.y + l.height / 2" class="lane-empty">queue empty</text>
        </g>
        <path v-for="e in graph.edges" :key="e.key" :d="`M ${e.x1} ${e.y1} C ${e.x1 + 40} ${e.y1}, ${e.x2 - 40} ${e.y2}, ${e.x2} ${e.y2}`" class="edge" marker-end="url(#tg-arrow)" />
        <g v-for="t in graph.tasks" :key="t.key">
          <title>{{ t.test }} ({{ t.page }})</title>
          <rect :x="t.x" :y="t.y" :width="W" :height="H" rx="6" class="task" :stroke="t.colour" :stroke-width="t.shown === 'planned' ? 1 : 2" />
          <text :x="t.x + 8" :y="t.y + 16" class="t-name">{{ t.label }}</text>
          <text :x="t.x + 8" :y="t.y + 31" class="t-sub" :fill="t.colour">{{ t.sub }}</text>
        </g>
      </svg>
    </div>
  </div>
</template>

<style scoped>
.task-graph { margin: 16px 0 }
.tg-title { margin: 0 0 4px; font-size: 13px; opacity: .8 }
.tg-scroll { overflow-x: auto; border: 1px solid var(--vp-c-divider); border-radius: 8px; background: var(--vp-c-bg-soft) }
.lane { fill: none; stroke: #59616d; stroke-opacity: .5 }
.lane-name { fill: #aab; font: bold 12px sans-serif; dominant-baseline: middle }
.lane-empty { fill: #868e96; font: italic 12px sans-serif; dominant-baseline: middle }
.task { fill: #1b1d22 }
.t-name { fill: #e6edf7; font: 12px sans-serif }
.t-sub { font: 10px ui-monospace, monospace }
.edge { fill: none; stroke: #adb5bd; stroke-width: 1.3; opacity: .8 }
</style>
