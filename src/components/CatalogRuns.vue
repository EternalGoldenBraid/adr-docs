<script setup>
// Runs the catalog node has written, read from tools/catalog_service.py on the machine that runs the jobs.
// Needs the ssh tunnel (ssh -L 8766:127.0.0.1:8766 HOST); local preview only.
// The list refreshes every few seconds, so a running job's progress moves; "Plot" draws its scalars live.
import { onMounted, onUnmounted, ref } from "vue"
import Plot from "./Plot.vue"
import RerunViewer from "./RerunViewer.vue"

const props = defineProps({ experiment: { type: String, default: "" }, base: { type: String, default: "http://127.0.0.1:8766" } })
const runs = ref(null), pick = ref(null), view = ref(""), err = ref("")
let timer = null

async function load() {
  try {
    const r = await fetch(`${props.base}/runs`, { cache: "no-store" })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    runs.value = (await r.json()).filter((m) => !props.experiment || m.experiment === props.experiment)
    err.value = ""
  } catch (e) {
    runs.value = []; err.value = e.message
  }
}
const item = (m, kind) => m.items.find((i) => i.kind === kind)
const key = (m) => m && m.experiment + "/" + m.run
const open = (m, what) => { pick.value = key(m); view.value = what }
const picked = () => runs.value?.find((m) => key(m) === pick.value)
const pct = (p) => Math.round((100 * p.step) / Math.max(p.total, 1))
onMounted(() => { load(); timer = setInterval(load, 3000) })
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <div>
    <div v-if="runs === null" class="muted">Looking for runs…</div>
    <div v-else-if="err" class="warn">The catalog service is not reachable ({{ err }}). Open the tunnel with <code>ssh -L 8766:127.0.0.1:8766 HOST</code>, then <button @click="load">retry</button>.</div>
    <div v-else-if="!runs.length" class="muted">No runs in the catalog yet.</div>
    <template v-else>
      <table class="status">
        <tr><th>Experiment</th><th>Run</th><th>Date</th><th>Machine</th><th>Progress</th><th>Files</th><th></th></tr>
        <tr v-for="m in runs" :key="key(m)" :class="{ sel: pick === key(m) }">
          <td>{{ m.experiment }}</td><td>{{ m.run }}</td><td>{{ m.date }}</td><td>{{ m.machine }}</td>
          <td><template v-if="m.progress"><progress :value="m.progress.step" :max="m.progress.total" /> {{ pct(m.progress) }}%</template></td>
          <td><a v-for="i in m.items" :key="i.file" :href="base + i.url" target="_blank">{{ i.title || i.file }}</a></td>
          <td>
            <button v-if="item(m, 'scalars')" @click="open(m, 'plot')">Plot</button>
            <button v-if="item(m, 'rerun')" @click="open(m, 'rerun')">Recording</button>
          </td>
        </tr>
      </table>
      <template v-if="picked()">
        <Plot v-if="view === 'plot'" :key="pick + view" :src="base + item(picked(), 'scalars').url" :live="2" :height="300" />
        <RerunViewer v-else :key="pick + view" :src="base + item(picked(), 'rerun').url" autoopen height="520px" />
      </template>
    </template>
  </div>
</template>

<style scoped>
select, button { background: #1e293b; color: #e2e8f0; border: 1px solid #475569; border-radius: 4px; padding: 3px 8px }
.status { width: 100%; font-size: 0.9em }
.status th { text-align: left; color: #94a3b8 }
.status a { margin-right: 10px }
.status button { margin-right: 4px }
progress { width: 80px; vertical-align: middle }
.sel td { background: #1e3a5f }
.muted { color: #94a3b8 }
.warn { color: #f87171 }
</style>
