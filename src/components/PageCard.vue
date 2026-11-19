<script setup>
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'

// <PageCard /> shows this page's card (front matter `card-*`); <PageCard board /> lists every page's one-line summary.
// Every slot has the same budget, so any two cards take the same effort to read.
const props = defineProps({ board: Boolean, budget: { type: Number, default: 120 } })
const { theme, page } = useData()
const SLOTS = ['what', 'state', 'evidence', 'next', 'owner']
const cards = computed(() => theme.value.cards || {})
const here = computed(() => {
  const slug = page.value.relativePath.replace(/\.md$/, '')
  return cards.value[slug === 'index' ? '/' : '/' + slug.split('/').map(encodeURIComponent).join('/')]
})
const clip = t => t.length > props.budget ? t.slice(0, props.budget - 1) + '…' : t
const over = t => t.length > props.budget
const ORDER = ['building', 'planned', 'idea', 'shipped', 'superseded']
const rows = computed(() => Object.entries(cards.value).filter(([, c]) => c.line || c.needsVerdict).map(([link, c]) => ({ link, ...c }))
  .sort((a, b) => Boolean(b.needsVerdict) - Boolean(a.needsVerdict) || ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.title.localeCompare(b.title)))
</script>

<template>
  <div v-if="board" class="pc-board">
    <a v-for="r in rows" :key="r.link" :href="withBase(r.link)" class="pc-row">
      <b :class="['pc-tag', r.status]">{{ r.status || '—' }}</b> <b v-if="r.needsVerdict" class="pc-tag needs">needs verdict</b> <span>{{ r.title }}</span><small> {{ clip(r.line) }}</small>
    </a>
    <p v-if="!rows.length" class="pc-empty">No page has a <code>card-line</code> yet.</p>
  </div>
  <div v-else-if="here" class="pc-card">
    <div v-if="here['superseded-by']" class="pc-super">Superseded by <a :href="withBase(here['superseded-by'])">{{ here['superseded-by'] }}</a>. Kept as history.</div>
    <div class="pc-head"><b :class="['pc-tag', here.status]" v-if="here.status">{{ here.status }}</b><b v-if="here.needsVerdict" class="pc-tag needs" title="Finished, but the Verdict and Learnings sections are missing or empty">needs verdict</b><span v-if="here.line">{{ clip(here.line) }}</span></div>
    <template v-for="k in SLOTS" :key="k"><div v-if="here[k]" class="pc-slot"><i>{{ k }}</i><span :title="over(here[k]) ? here[k] : undefined">{{ clip(here[k]) }}</span></div></template>
  </div>
</template>

<style>
.pc-card { border: 1px solid var(--vp-c-divider); border-left: 3px solid var(--vp-c-brand-1); border-radius: 8px; padding: 10px 14px; margin: 12px 0; font-size: 14px; background: var(--vp-c-bg-soft) }
.pc-head { font-weight: 600; margin-bottom: 6px; display: flex; gap: 8px; align-items: baseline }
.pc-slot { display: grid; grid-template-columns: 72px 1fr; gap: 8px; padding: 2px 0 }
.pc-slot i { color: var(--vp-c-text-2); font-style: normal; font-size: 12px; text-transform: uppercase; padding-top: 2px }
.pc-tag { font-size: 11px; text-transform: uppercase; padding: 1px 6px; border-radius: 4px; background: var(--vp-c-default-soft); color: var(--vp-c-text-2) }
.pc-tag.building { background: #51cf6633; color: #2b8a3e }
.pc-tag.planned { background: #fcc41933; color: #a67c00 }
.pc-tag.needs { background: #ff922b44; color: #d9480f }
.pc-tag.idea { background: #74c0fc33; color: #1c7ed6 }
.pc-board { display: flex; flex-direction: column; gap: 4px; margin: 12px 0; font-size: 14px }
.pc-row { display: block; padding: 4px 10px; border: 1px solid var(--vp-c-divider); border-radius: 6px; text-decoration: none; color: var(--vp-c-text-1) }
.pc-row small { margin-left: 8px; color: var(--vp-c-text-2); font-size: 13px }
.pc-super { margin-bottom: 8px; padding: 4px 8px; border-radius: 4px; background: #adb5bd33; font-size: 13px }
</style>
