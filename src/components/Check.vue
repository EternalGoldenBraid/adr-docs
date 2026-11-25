<script setup>
// One test's machine check, placed where its data will land on the page. Before any run it shows the condition
// and an empty progress bar; while the run goes, the stat so far against the threshold; at phase "done", met or not.
// The check is the test's front matter `check: {run, field, stat, op, value, when}`; ticking the card is tools/exp_index.py --verify.
import { computed, onMounted, onUnmounted, ref } from "vue"
import { useData } from "vitepress"
import fieldNames from "./fieldNames.json"

const props = defineProps({ test: { type: String, required: true }, base: { type: String, default: "http://127.0.0.1:8766" } })
const { frontmatter, page } = useData()
const t = computed(() => (frontmatter.value.card?.tests || []).find((x) => x.id === props.test))
const c = computed(() => t.value?.check)
const experiment = computed(() => c.value?.experiment || page.value.relativePath.split("/").pop().replace(/\.md$/, ""))
const run = ref(null), got = ref(null)
let timer = null

const stats = {
  min: (v) => Math.min(...v), max: (v) => Math.max(...v), last: (v) => v[v.length - 1],
  mean: (v) => v.reduce((a, b) => a + b, 0) / v.length,
  median: (v) => { const s = [...v].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 },
}
const ops = { "<": (a, b) => a < b, "<=": (a, b) => a <= b, ">": (a, b) => a > b, ">=": (a, b) => a >= b }

let busy = false
async function load() {
  if (!c.value || busy) return
  busy = true
  try {
    const runs = await (await fetch(`${props.base}/runs`, { cache: "no-store" })).json()
    run.value = runs.find((m) => m.experiment === experiment.value && m.run === c.value.run) || null
    const sc = run.value?.items.find((i) => i.kind === "scalars")
    if (!sc) { got.value = null; return }
    const text = await (await fetch(props.base + sc.url, { cache: "no-store" })).text()
    const v = text.split("\n").filter(Boolean).map((l) => JSON.parse(l)[c.value.field]).filter((x) => typeof x === "number")
    got.value = v.length ? stats[c.value.stat](v) : null
    // A finished run no longer changes, and its file can be large; fetch it once.
    if (done.value) clearInterval(timer)
  } catch { run.value = null; got.value = null } finally { busy = false }
}
const p = computed(() => run.value?.progress)
const done = computed(() => p.value?.phase === (c.value?.when || "done"))
const ok = computed(() => got.value !== null && ops[c.value.op](got.value, c.value.value))
const state = computed(() => !run.value ? "waiting" : !done.value ? "running" : ok.value ? "met" : "not met")
const fmt = (x) => (x === null ? "–" : +x.toPrecision(3))
onMounted(() => { load(); timer = setInterval(load, 2000) })
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <div class="run-check" :id="`test-${t.id}`" :class="state.replace(' ', '-')">
    <template v-if="c">
      <div><b>Check “{{ t.id }}”:</b> {{ c.stat }} of {{ fieldNames[c.field] ?? "" }} <code>{{ c.field }}</code> {{ c.op }} {{ c.value }}, on run <code>{{ c.run }}</code>, when it reaches “{{ c.when || "done" }}”.</div>
      <div class="row">
        <progress :value="p?.step || 0" :max="p?.total || 1" /> {{ p ? Math.round((100 * p.step) / Math.max(p.total, 1)) : 0 }}%
        <span class="state">{{ state }}</span>
        <span v-if="run">{{ done ? "measured" : "so far" }} {{ fmt(got) }}, needs {{ c.op }} {{ c.value }}</span>
        <span v-else class="muted">no data yet</span>
      </div>
    </template>
    <div v-else class="warn">Test “{{ test }}” has no <code>check</code> in the front matter.</div>
  </div>
</template>

<style scoped>
.run-check { border: 1px solid #475569; border-left-width: 4px; border-radius: 4px; padding: 8px 12px; margin: 12px 0 }
.row { margin-top: 6px; display: flex; gap: 12px; align-items: center }
progress { width: 140px }
.state { font-weight: 600; text-transform: uppercase; font-size: 0.85em }
.waiting { border-left-color: #64748b } .running { border-left-color: #eab308 }
.met { border-left-color: #22c55e } .not-met { border-left-color: #ef4444 }
.met .state { color: #22c55e } .not-met .state { color: #ef4444 } .running .state { color: #eab308 }
.muted { color: #94a3b8 } .warn { color: #f87171 }
</style>
