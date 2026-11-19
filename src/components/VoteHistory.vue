<script setup>
import { computed, onMounted, ref } from 'vue'
import { useData } from 'vitepress'

// Effort-vote history from votes.json: one row per item, its rounds indented under it, and SVG plots of the spread.
// <VoteHistory /> shows every item; <VoteHistory page="/experiments/x" /> only that page's.
const props = defineProps({ page: String, perPage: { type: Number, default: 10 } })
const { theme } = useData()
const live = ref(null)
onMounted(async () => {
  try {
    const r = await fetch('/__preview_comments/votes', { headers: { 'X-Preview-Comment': '1' } })
    if (r.ok) live.value = (await r.json()).votes
  } catch { /* published site: the baked-in copy is used */ }
})
const items = computed(() => (live.value ?? theme.value.votes ?? []).filter(i => !props.page || i.page === props.page).slice().reverse())
const pageNo = ref(0)
const shown = computed(() => items.value.slice(pageNo.value * props.perPage, (pageNo.value + 1) * props.perPage))
const pages = computed(() => Math.max(1, Math.ceil(items.value.length / props.perPage)))
const SCALE = [1, 2, 3, 5, 8, 13, 21]
const num = v => v === undefined ? '–' : v
const revealed = i => i.rounds.filter(r => r.revealed)

// Plot 1: per item, every round's votes as dots on the Fibonacci scale (x = round, y = vote), with the median as a bar.
const W = 220, H = 110, P = 18
const y = v => H - P - (SCALE.indexOf(v) / (SCALE.length - 1)) * (H - 2 * P)
// Identical votes are spread sideways so each dot stays visible.
const jitter = (votes, agent, k) => { const same = Object.keys(votes).filter(a => votes[a] === votes[agent]); return (same.indexOf(agent) - (same.length - 1) / 2) * 7 }
const x = (r, n) => P + (n <= 1 ? (W - 2 * P) / 2 : ((r - 1) / (n - 1)) * (W - 2 * P))
// Plot 2: how many rounds each decided item needed.
const decided = computed(() => items.value.filter(i => i.weight))
const roundsNeeded = computed(() => { const c = {}; for (const i of decided.value) c[i.rounds.length] = (c[i.rounds.length] || 0) + 1; return Object.entries(c).map(([n, k]) => ({ n: +n, k })).sort((a, b) => a.n - b.n) })
const maxK = computed(() => Math.max(1, ...roundsNeeded.value.map(r => r.k)))
</script>

<template>
  <div class="vh">
    <p v-if="!items.length" class="vh-empty">No votes recorded yet.</p>
    <details v-for="i in shown" :key="i.page + i.item" class="vh-item">
      <summary><b>{{ i.item }}</b> <span class="vh-page">{{ i.page }}</span> <span v-if="i.owner">· owner {{ i.owner }}</span>
        <span :class="['vh-w', i.weight ? 'done' : 'open']">{{ i.weight ? 'weight ' + i.weight : 'voting' }}</span></summary>
      <div class="vh-body">
        <svg v-if="revealed(i).length" :viewBox="`0 0 ${W} ${H}`" class="vh-plot" role="img" :aria-label="`Votes per round for ${i.item}`">
          <line v-for="s in SCALE" :key="s" :x1="P" :x2="W - P" :y1="y(s)" :y2="y(s)" class="vh-grid" /><text v-for="s in SCALE" :key="'t' + s" :x="2" :y="y(s) + 3" class="vh-tick">{{ s }}</text>
          <g v-for="r in revealed(i)" :key="r.round">
            <line :x1="x(r.round, revealed(i).length) - 8" :x2="x(r.round, revealed(i).length) + 8" :y1="y(r.median)" :y2="y(r.median)" class="vh-median" />
            <circle v-for="(v, a, k) in r.votes" :key="a" :cx="x(r.round, revealed(i).length) + jitter(r.votes, a, k)" :cy="y(v)" r="3" class="vh-dot"><title>{{ a }}: {{ v }}</title></circle>
          </g>
        </svg>
        <div v-for="r in i.rounds" :key="r.round" class="vh-round">
          <b class="vh-rn">Round {{ r.round }}</b>
          <template v-if="r.revealed">
            <span>mean {{ r.mean }} · variance {{ r.variance }} · <em :class="r.converged ? 'ok' : 'no'">{{ r.converged ? 'converged' : 'not converged' }}</em></span>
            <ul><li v-for="(v, a) in r.votes" :key="a"><b>{{ a }}</b> {{ v }}<span v-if="r.notes?.[a]"> — {{ r.notes[a] }}</span></li></ul>
            <p v-if="r.ownerReply" class="vh-reply">Owner: {{ r.ownerReply }}</p>
          </template>
          <span v-else>open · voted: {{ (r.voted || []).join(', ') || 'nobody yet' }}</span>
        </div>
      </div>
    </details>
    <div v-if="pages > 1" class="vh-pager"><button :disabled="pageNo === 0" @click="pageNo--">‹</button> {{ pageNo + 1 }} / {{ pages }} <button :disabled="pageNo + 1 >= pages" @click="pageNo++">›</button></div>
    <div v-if="roundsNeeded.length" class="vh-sum">
      <b>Rounds needed to decide</b>
      <svg :viewBox="`0 0 ${W} 70`" class="vh-plot" role="img" aria-label="Rounds needed per decided item">
        <g v-for="(r, k) in roundsNeeded" :key="r.n"><rect :x="P + k * 40" :y="55 - (r.k / maxK) * 40" width="28" :height="(r.k / maxK) * 40" class="vh-bar" /><text :x="P + k * 40 + 14" y="66" class="vh-tick mid">{{ r.n }}</text><text :x="P + k * 40 + 14" :y="52 - (r.k / maxK) * 40" class="vh-tick mid">{{ r.k }}</text></g>
      </svg>
    </div>
  </div>
</template>

<style scoped>
.vh-item { border: 1px solid var(--vp-c-divider); border-radius: 6px; margin: 6px 0; padding: 4px 10px }
.vh-page { color: var(--vp-c-text-3); font-size: 12px }
.vh-w { float: right; font-size: 12px; padding: 0 8px; border-radius: 8px }
.vh-w.done { background: #2b8a3e22; color: #2b8a3e } .vh-w.open { background: #ff922b33; color: #d9480f }
.vh-body { padding: 4px 0 8px }
.vh-round { margin: 6px 0 6px 18px; font-size: 13px }
.vh-rn { margin-right: 8px }
.vh-round ul { margin: 2px 0 2px 16px; padding: 0 } .vh-round li { margin: 0; line-height: 1.5 } .vh-reply { margin: 2px 0 2px 16px; font-style: italic }
.ok { color: #2b8a3e } .no { color: #c92a2a }
.vh-plot { width: 260px; max-width: 100%; display: block; margin: 4px 0 }
.vh-grid { stroke: var(--vp-c-divider); stroke-width: .5 } .vh-tick { font-size: 7px; fill: var(--vp-c-text-3) } .vh-tick.mid { text-anchor: middle }
.vh-median { stroke: #1c7ed6; stroke-width: 2 } .vh-dot { fill: #e8590c } .vh-bar { fill: #1c7ed6 }
.vh-pager { text-align: center; margin: 6px 0 } .vh-pager button { padding: 0 8px }
</style>
