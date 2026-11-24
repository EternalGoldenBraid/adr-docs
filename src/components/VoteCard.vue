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
const W = 240, H = 150, PL = 10, PB = 22, PT = 14
const LO = -0.5, HI = 6.5
// The Plotly colours the site's plots use.
const COLORS = ['#636efa', '#ef553b', '#00cc96', '#ab63fa', '#ffa15a', '#19d3f3']
const revealed = i => i.rounds.filter(r => r.revealed)
const latest = i => revealed(i).at(-1)
const earlier = i => revealed(i).slice(0, -1).map(r => curves(r).combined).filter(Boolean)
const gx = t => PL + ((t - LO) / (HI - LO)) * (W - 2 * PL)
// Each vote is a normal curve over scale steps: mean = the price's step index, spread = σ in steps (default 3), every area 1.
// The combined curve is the precision-weighted product: mean Σ(x/σ²)/Σ(1/σ²), variance 1/Σ(1/σ²), over the voters who state a σ.
const pdf = (t, m, sd) => Math.exp(-0.5 * ((t - m) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI))
const sigma = (r, a) => r.precision?.[a] || 3
const curves = r => {
  const voters = Object.entries(r.votes).map(([a, v], k) => ({ a, m: SCALE.indexOf(v), sd: sigma(r, a), color: COLORS[k % COLORS.length], stated: Boolean(r.precision?.[a]) }))
  const sure = voters.filter(v => v.stated)
  const w = sure.reduce((t, v) => t + 1 / v.sd ** 2, 0)
  const combined = w ? { a: 'combined', m: sure.reduce((t, v) => t + v.m / v.sd ** 2, 0) / w, sd: Math.sqrt(1 / w), color: 'var(--vp-c-text-1)', stated: true } : null
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
    <div v-if="items.some(latest)" class="vc-grid">
      <figure v-for="i in items.filter(latest)" :key="i.item" class="vc-fig">
        <svg :viewBox="`0 0 ${W} ${H}`" :width="W" class="vc-plot" role="img" :aria-label="`Vote curves for ${i.item}, round ${latest(i).round}`">
          <text :x="PL" y="10" class="vc-title">{{ i.item }} · round {{ latest(i).round }}</text>
          <line :x1="gx(LO)" :x2="gx(HI)" :y1="H - PB" :y2="H - PB" class="vc-axis" />
          <g v-for="(p, t) in SCALE" :key="p"><line :x1="gx(t)" :x2="gx(t)" :y1="PT" :y2="H - PB" class="vc-gridline" /><text :x="gx(t)" :y="H - 8" class="vc-tick">{{ p }}</text></g>
          <path v-for="(c, n) in earlier(i)" :key="'e' + n" :d="c.d" class="vc-curve vc-earlier"><title>combined, earlier round</title></path>
          <line v-if="curves(latest(i)).median >= 0" :x1="gx(curves(latest(i)).median)" :x2="gx(curves(latest(i)).median)" :y1="PT" :y2="H - PB" class="vc-median"><title>median {{ latest(i).median }}</title></line>
          <path v-for="c in curves(latest(i)).voters" :key="c.a" :d="c.d" :stroke="c.color" :class="['vc-curve', { vague: !c.stated }]"><title>{{ c.a }}: price {{ SCALE[c.m] }}, σ {{ c.sd }}{{ c.stated ? '' : ' (not stated, drawn as 3)' }}</title></path>
          <path v-if="curves(latest(i)).combined" :d="curves(latest(i)).combined.d" class="vc-curve vc-combined"><title>combined: σ {{ curves(latest(i)).combined.sd.toFixed(2) }}</title></path>
        </svg>
        <figcaption><span v-for="c in curves(latest(i)).voters" :key="c.a" :style="{ color: c.color }">{{ c.a }}</span><span v-if="curves(latest(i)).combined" class="vc-comb">combined</span></figcaption>
      </figure>
    </div>
    <table v-for="i in items" :key="i.item" class="vc-table">
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
  </div>
</template>

<style scoped>
.vc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px 16px; margin: 8px 0 }
.vc-fig { margin: 0; font-family: var(--vp-font-family-base) }
.vc-plot { max-width: 100%; height: auto; display: block }
.vc-fig figcaption { font-size: 11px } .vc-fig figcaption span { margin-right: 8px } .vc-comb { color: var(--vp-c-text-1) }
.vc-axis { stroke: var(--vp-c-text-3); stroke-width: .8 } .vc-gridline { stroke: var(--vp-c-divider); stroke-width: .6 }
.vc-tick { font-size: 10px; fill: var(--vp-c-text-2); text-anchor: middle } .vc-title { font-size: 11px; fill: var(--vp-c-text-1) }
.vc-median { stroke: var(--vp-c-text-2); stroke-width: 1; stroke-dasharray: 4 3 }
.vc-curve { fill: none; stroke-width: 1.6; opacity: .9 } .vc-curve.vague { stroke-dasharray: 2 2 }
.vc-combined { stroke: var(--vp-c-text-1); stroke-width: 2.4; opacity: 1 } .vc-earlier { stroke: var(--vp-c-text-3); stroke-width: 1; opacity: .5; stroke-dasharray: 3 3 }
.vc-table { width: auto; min-width: 60%; font-size: 13px }
.vc-table caption { text-align: left; padding: 4px 0 }
.vc-table th, .vc-table td { padding: 2px 10px }
.vc-open { color: var(--vp-c-text-3) }
</style>
