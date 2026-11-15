<script setup>
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'

// Compact strip for any page: every active ticket plus the next few queued ones, in priority order.
const props = defineProps({ queued: { type: Number, default: 3 }, board: { type: String, default: '/workstreams/' } })
const { theme } = useData()
const items = computed(() => Object.entries(theme.value.workstreams || {}).map(([id, w]) => ({ id, ...w })))
const rank = i => i.priority ?? Infinity
const pick = status => items.value.filter(i => i.status === status).sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id))
const rows = computed(() => [...pick('active').map(i => ({ ...i, tag: 'active' })), ...pick('queued').slice(0, props.queued).map(i => ({ ...i, tag: 'next' }))])
</script>

<template>
  <div class="wsn">
    <a v-for="r in rows" :key="r.id" :href="withBase(`/workstreams/${r.id}`)" :class="['wsn-item', r.tag]">
      <b>{{ r.tag }}</b> {{ r.title }}<small v-if="r.owner"> · {{ r.owner }}</small><small v-if="r.total"> · {{ r.done }}/{{ r.total }}</small>
    </a>
    <a class="wsn-all" :href="withBase(board)">All work →</a>
  </div>
</template>

<style>
.wsn { display: flex; flex-direction: column; gap: 4px; margin: 12px 0; font-size: 13px }
.wsn-item { display: block; padding: 4px 10px; border: 1px solid var(--vp-c-divider); border-left-width: 3px; border-radius: 6px; text-decoration: none; color: var(--vp-c-text-1) }
.wsn-item.active { border-left-color: #51cf66 }
.wsn-item.next { border-left-color: #fcc419 }
.wsn-item b { text-transform: uppercase; font-size: 11px; color: var(--vp-c-text-2) }
.wsn small { color: var(--vp-c-text-2) }
.wsn-all { font-size: 12px }
</style>
