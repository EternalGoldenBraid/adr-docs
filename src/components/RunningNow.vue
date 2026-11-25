<script setup>
// Every catalog run that has not reached its last step, from the manifests' `progress`; refreshes every 30 s.
import { computed, onMounted, onBeforeUnmount, ref } from "vue"

const props = defineProps({ base: { type: String, default: "http://127.0.0.1:8766" } })
const runs = ref(null)
const failed = ref(false)
let timer = null

async function load() {
  try {
    const all = await (await fetch(`${props.base}/runs`, { cache: "no-store" })).json()
    runs.value = all.filter(r => r.progress && r.progress.total && r.progress.step < r.progress.total)
    failed.value = false
  } catch { failed.value = true }
}
onMounted(() => { load(); timer = setInterval(load, 30000) })
onBeforeUnmount(() => clearInterval(timer))

const rows = computed(() => (runs.value || []).map(r => ({
  key: `${r.experiment}/${r.run}`,
  page: `/experiments/${r.experiment}`,
  experiment: r.experiment,
  run: r.run,
  machine: r.machine || "",
  phase: r.progress.phase || "",
  step: r.progress.step,
  total: r.progress.total,
  pct: Math.round((100 * r.progress.step) / r.progress.total),
  headline: r.headline ? `${r.headline.name} ${r.headline.value} ${r.headline.unit || ""}` : "",
})))
</script>

<template>
  <p v-if="failed" class="miss">The catalog is not reachable, so running jobs cannot be listed.</p>
  <p v-else-if="runs === null">Loading running jobs…</p>
  <p v-else-if="!rows.length">No catalog run is in progress.</p>
  <table v-else class="running-now">
    <thead><tr><th>Ticket</th><th>Run</th><th>Machine</th><th>Phase</th><th>Progress</th><th>Headline</th></tr></thead>
    <tbody>
      <tr v-for="r in rows" :key="r.key">
        <td><a :href="r.page">{{ r.experiment }}</a></td>
        <td><code>{{ r.run }}</code></td>
        <td>{{ r.machine }}</td>
        <td>{{ r.phase }}</td>
        <td>{{ r.step }} / {{ r.total }} ({{ r.pct }} %)</td>
        <td>{{ r.headline }}</td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.miss { color: #f87171 }
</style>
