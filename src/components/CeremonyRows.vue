<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'

// The daily ceremony as one row per ticket, read-only, from ceremony.json at the site root:
// {date, closes, rows:[{ticket, page, planned, observed, owner, note, positions:{name:{vote:"agree"|"challenge", line, at}}, voters?}]}
const data = ref({ rows: [] })
const error = ref('')
let timer
const load = async () => {
  try {
    const r = await fetch('/__preview_comments/ceremony', { headers: { 'X-Preview-Comment': '1' } })
    data.value = await r.json()
    error.value = ''
  } catch { error.value = 'The ceremony is only shown on the live preview.' }
}
onMounted(() => { load(); timer = setInterval(load, 15000) })
onUnmounted(() => clearInterval(timer))

const SCALE = [1, 2, 3, 5, 8, 13, 21]
const steps = row => row.observed == null || row.planned == null ? 0 : Math.abs(SCALE.indexOf(row.observed) - SCALE.indexOf(row.planned))
const voters = row => row.voters ?? Object.keys(row.positions ?? {})
const state = (row, who) => row.positions?.[who]?.vote ?? 'none'
const settled = row => voters(row).length > 0 && voters(row).every(who => state(row, who) === 'agree')
const challenged = row => voters(row).some(who => state(row, who) === 'challenge')
const rows = computed(() => data.value.rows ?? [])
const done = computed(() => rows.value.filter(settled).length)
const ICON = { agree: '✓', challenge: '⚑', none: '○' }
</script>

<template>
  <div class="cr">
    <p v-if="error" class="cr-note">{{ error }}</p>
    <p v-else-if="!rows.length" class="cr-note">No ceremony rows yet.</p>
    <template v-else>
      <p class="cr-head"><b>{{ data.date }}</b> · {{ done }}/{{ rows.length }} settled<span v-if="data.closes"> · closes {{ data.closes }}</span></p>
      <div v-for="row in rows" :key="row.ticket + row.page" class="cr-row" :class="{ settled: settled(row), challenged: challenged(row) }">
        <div class="cr-main">
          <a :href="row.page" class="cr-ticket">{{ row.ticket }}</a>
          <span class="cr-effort">
            <span title="planned">{{ row.planned ?? '–' }}</span>
            <span class="cr-arrow">→</span>
            <span title="observed" :class="{ surprise: steps(row) > 0 }">{{ row.observed ?? '–' }}</span>
            <span v-if="steps(row) > 0" class="cr-surprise" :title="steps(row) + ' Fibonacci step(s) from the estimate'">surprise ±{{ steps(row) }}</span>
          </span>
          <span class="cr-state">{{ settled(row) ? 'settled' : challenged(row) ? 'challenged' : 'open' }}</span>
        </div>
        <p v-if="row.note" class="cr-note-owner"><b>{{ row.owner }}</b> reports: {{ row.note }}</p>
        <p class="cr-voters">
          <span v-for="who in voters(row)" :key="who" class="cr-chip" :class="state(row, who)" :title="row.positions?.[who]?.line || ''">{{ ICON[state(row, who)] }} {{ who }}</span>
        </p>
        <ul v-if="voters(row).some(who => row.positions?.[who]?.line)" class="cr-lines">
          <li v-for="who in voters(row).filter(w => row.positions?.[w]?.line)" :key="who"><b>{{ who }}</b>: {{ row.positions[who].line }}</li>
        </ul>
      </div>
    </template>
  </div>
</template>

<style scoped>
.cr-row { border: 1px solid var(--vp-c-divider); border-left: 4px solid var(--vp-c-divider); border-radius: 6px; padding: 8px 12px; margin: 8px 0; }
.cr-row.settled { border-left-color: #3fb950; }
.cr-row.challenged { border-left-color: #d29922; }
.cr-main { display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; }
.cr-ticket { font-weight: 600; flex: 1; min-width: 12ch; }
.cr-effort { font-variant-numeric: tabular-nums; }
.cr-arrow { color: var(--vp-c-text-3); margin: 0 3px; }
.surprise { font-weight: 700; color: #d29922; }
.cr-surprise { margin-left: 6px; padding: 0 7px; font-size: 11px; border-radius: 999px; background: rgba(210, 153, 34, .15); color: #d29922; }
.cr-state { font-size: 12px; color: var(--vp-c-text-2); }
.cr-note-owner, .cr-head, .cr-note { font-size: 13px; margin: 4px 0; color: var(--vp-c-text-2); }
.cr-voters { margin: 6px 0 0; display: flex; gap: 6px; flex-wrap: wrap; }
.cr-chip { font-size: 12px; padding: 1px 9px; border-radius: 999px; border: 1px solid var(--vp-c-divider); color: var(--vp-c-text-2); }
.cr-chip.agree { color: #3fb950; border-color: rgba(63, 185, 80, .45); background: rgba(63, 185, 80, .1); }
.cr-chip.challenge { color: #d29922; border-color: rgba(210, 153, 34, .5); background: rgba(210, 153, 34, .12); }
.cr-lines { margin: 4px 0 0; padding-left: 18px; font-size: 13px; }
</style>
