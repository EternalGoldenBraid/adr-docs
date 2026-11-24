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
const W = 260, H = 130, PL = 10, PB = 20, PT = 8
const LO = -0.5, HI = 6.5
const COLORS = ['#e8590c', '#1c7ed6', '#2b8a3e', '#ae3ec9', '#c2255c', '#0c8599']
const revealed = i => i.rounds.filter(r => r.revealed)
const gx = t => PL + ((t - LO) / (HI - LO)) * (W - 2 * PL)
// Each vote is a normal curve over scale steps: mean = the price's step index, spread = σ in steps (default 3), every area 1.
// The combined curve is the precision-weighted product: mean Σ(x/σ²)/Σ(1/σ²), variance 1/Σ(1/σ²), over the voters who state a σ.
const pdf = (t, m, sd) => Math.exp(-0.5 * ((t - m) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI))
const sigma = (r, a) => r.precision?.[a] || 3
const curves = r => {
  const voters = Object.entries(r.votes).map(([a, v], k) => ({ a, m: SCALE.indexOf(v), sd: sigma(r, a), color: COLORS[k % COLORS.length], stated: Boolean(r.precision?.[a]) }))
  const sure = voters.filter(v => v.stated)
  const w = sure.reduce((t, v) => t + 1 / v.sd ** 2, 0)
  const combined = w ? { a: 'combined', m: sure.reduce((t, v) => t + v.m / v.sd ** 2, 0) / w, sd: Math.sqrt(1 / w), color: 'currentColor', stated: true } : null
  const top = Math.max(...[...voters, ...(combined ? [combined] : [])].map(c => pdf(c.m, c.m, c.sd)))
  const path = c => Array.from({ length: 71 }, (_, n) => { const t = LO + (n / 70) * (HI - LO); return `${n ? 'L' : 'M'}${gx(t).toFixed(1)},${(H - PB - (pdf(t, c.m, c.sd) / top) * (H - PB - PT)).toFixed(1)}` }).join('')
  return { voters: voters.map(v => ({ ...v, d: path(v) })), combined: combined && { ...combined, d: path(combined) }, median: SCALE.indexOf(r.median) }
}
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
    <div v-if="revealed(i).length" class="vc-plots">
      <figure v-for="r in revealed(i)" :key="r.round" class="vc-fig">
        <svg :viewBox="`0 0 ${W} ${H}`" class="vc-plot" role="img" :aria-label="`Vote curves for ${i.item}, round ${r.round}`">
          <line :x1="gx(LO)" :x2="gx(HI)" :y1="H - PB" :y2="H - PB" class="vc-axis" />
          <g v-for="(p, t) in SCALE" :key="p"><line :x1="gx(t)" :x2="gx(t)" :y1="H - PB" :y2="H - PB + 3" class="vc-axis" /><text :x="gx(t)" :y="H - 6" class="vc-tick">{{ p }}</text></g>
          <line v-if="curves(r).median >= 0" :x1="gx(curves(r).median)" :x2="gx(curves(r).median)" :y1="PT" :y2="H - PB" class="vc-median"><title>median {{ r.median }}</title></line>
          <path v-for="c in curves(r).voters" :key="c.a" :d="c.d" :stroke="c.color" :class="['vc-curve', { vague: !c.stated }]"><title>{{ c.a }}: price {{ SCALE[c.m] }}, σ {{ c.sd }}{{ c.stated ? '' : ' (not stated, drawn as 3)' }}</title></path>
          <path v-if="curves(r).combined" :d="curves(r).combined.d" class="vc-curve vc-combined"><title>combined: σ {{ curves(r).combined.sd.toFixed(2) }}</title></path>
        </svg>
        <figcaption>Round {{ r.round }}: <span v-for="c in curves(r).voters" :key="c.a" :style="{ color: c.color, marginRight: '6px' }">{{ c.a }}</span><span v-if="curves(r).combined">· <b>combined</b> · </span>median bar</figcaption>
      </figure>
    </div>
    </div>
  </div>
</template>

<style scoped>
.vc-row { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; margin: 8px 0 }
.vc-plots { display: flex; flex-wrap: wrap; gap: 12px }
.vc-fig { margin: 0 } .vc-fig figcaption { font-size: 11px; color: var(--vp-c-text-3) }
.vc-plot { width: 260px; max-width: 100%; display: block }
.vc-axis { stroke: var(--vp-c-text-3); stroke-width: .6 } .vc-tick { font-size: 7px; fill: var(--vp-c-text-3); text-anchor: middle }
.vc-median { stroke: #f59f00; stroke-width: 1.5; stroke-dasharray: 3 2 }
.vc-curve { fill: none; stroke-width: 1.3; opacity: .85 } .vc-curve.vague { stroke-dasharray: 2 2 } .vc-combined { stroke: var(--vp-c-text-1); stroke-width: 2.4; opacity: 1 }
</style>
