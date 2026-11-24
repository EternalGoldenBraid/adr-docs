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
const items = computed(() => {
  const here = clean(props.page || route.path)
  return (live.value ?? theme.value.votes ?? []).filter(i => clean(i.page) === here && (!props.item || i.item === props.item))
})
</script>

<template>
  <div class="vc">
    <p v-if="!items.length" class="vc-empty">No votes recorded for this page yet.</p>
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
.vc-table { width: auto; min-width: 60%; font-size: 13px }
.vc-table caption { text-align: left; padding: 4px 0 }
.vc-table th, .vc-table td { padding: 2px 10px }
.vc-open { color: var(--vp-c-text-3) }
</style>
