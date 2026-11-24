<script setup>
import { computed, onMounted, ref } from 'vue'
import { useData, useRoute } from 'vitepress'

// The vote card of a page, drawn from votes.json with fixed columns: nobody writes the table.
// <VoteCard /> shows the current page's items; <VoteCard item="vpcast" /> one item. A missing σ is an empty cell.
const props = defineProps({ page: String, item: String })
const { theme } = useData()
const route = useRoute()
const live = ref(null)
onMounted(async () => {
  try {
    const r = await fetch('/__preview_comments/votes', { headers: { 'X-Preview-Comment': '1' } })
    if (r.ok) live.value = (await r.json()).votes
  } catch { /* published site: the baked-in copy is used */ }
})
const clean = p => String(p || '').replace(/\.html$/, '').replace(/\/index$/, '/').replace(/(.)\/$/, '$1')
const SCALE = [1, 2, 3, 5, 8, 13, 21]
const W = 220, H = 110, P = 18
const y = v => H - P - (SCALE.indexOf(v) / (SCALE.length - 1)) * (H - 2 * P)
const revealed = i => i.rounds.filter(r => r.revealed)
const x = (r, n) => P + (n <= 1 ? (W - 2 * P) / 2 : ((r - 1) / (n - 1)) * (W - 2 * P))
// Dots larger for more precise votes (σ in scale steps, default 3); identical votes are spread sideways.
const dotR = (r, a) => 2 + 2 / (r.precision?.[a] || 3)
const jitter = (votes, agent) => { const same = Object.keys(votes).filter(a => votes[a] === votes[agent]); return (same.indexOf(agent) - (same.length - 1) / 2) * 7 }
const items = computed(() => {
  const here = clean(props.page || route.path)
  return (live.value ?? theme.value.votes ?? []).filter(i => clean(i.page) === here && (!props.item || i.item === props.item))
})
</script>

<template>
  <div class="vc">
    <p v-if="!items.length" class="vc-empty">No votes recorded for this page yet.</p>
    <div v-for="i in items" :key="i.item" class="vc-row">
    <table class="vc-table">
      <caption><b>{{ i.item }}</b><span v-if="i.owner"> · owner {{ i.owner }}</span> · {{ i.weight ? 'weight ' + i.weight : 'voting' }}</caption>
      <thead><tr><th>Round</th><th>Voter</th><th>Price</th><th>σ</th><th>Median</th><th>Weighted mean</th><th>Converged</th></tr></thead>
      <tbody v-for="r in i.rounds" :key="r.round">
        <template v-if="r.revealed">
          <tr v-for="(v, a) in r.votes" :key="a">
            <td>{{ r.round }}</td><td>{{ a }}</td><td>{{ v }}</td><td>{{ r.precision?.[a] ?? '' }}</td>
            <td>{{ r.median }}</td><td>{{ r.weightedMean ?? '' }}</td>
            <td>{{ r.converged ? 'yes' : 'no' }}</td>
          </tr>
        </template>
        <tr v-else><td>{{ r.round }}</td><td colspan="6" class="vc-open">open · voted: {{ (r.voted || []).join(', ') || 'nobody yet' }}</td></tr>
      </tbody>
    </table>
    <svg v-if="revealed(i).length" :viewBox="`0 0 ${W} ${H}`" class="vc-plot" role="img" :aria-label="`Votes per round for ${i.item}`">
      <line v-for="s in SCALE" :key="s" :x1="P" :x2="W - P" :y1="y(s)" :y2="y(s)" class="vc-grid" /><text v-for="s in SCALE" :key="'t' + s" :x="2" :y="y(s) + 3" class="vc-tick">{{ s }}</text>
      <g v-for="r in revealed(i)" :key="r.round">
        <line :x1="x(r.round, revealed(i).length) - 12" :x2="x(r.round, revealed(i).length) + 12" :y1="y(r.median)" :y2="y(r.median)" class="vc-median" />
        <circle v-for="(v, a) in r.votes" :key="a" :cx="x(r.round, revealed(i).length) + jitter(r.votes, a)" :cy="y(v)" :r="dotR(r, a)" class="vc-dot"><title>{{ a }}: {{ v }}{{ r.precision?.[a] ? ' (σ ' + r.precision[a] + ')' : '' }}</title></circle>
      </g>
    </svg>
    </div>
  </div>
</template>

<style scoped>
.vc-row { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; margin: 8px 0 }
.vc-plot { width: 260px; max-width: 100%; display: block }
.vc-grid { stroke: var(--vp-c-divider); stroke-width: .5 } .vc-tick { font-size: 7px; fill: var(--vp-c-text-3) }
.vc-median { stroke: #1c7ed6; stroke-width: 2 } .vc-dot { fill: #e8590c }
.vc-table { width: auto; min-width: 60%; font-size: 13px }
.vc-table caption { text-align: left; padding: 4px 0 }
.vc-table th, .vc-table td { padding: 2px 10px }
.vc-open { color: var(--vp-c-text-3) }
</style>
