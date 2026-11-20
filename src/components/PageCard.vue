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
const MARK = { done: '✓', running: '◐', planned: '○', obsolete: '✗', failed: '✕' }
const ageDays = d => d ? Math.floor((Date.now() - Date.parse(d)) / 864e5) : null
const tests = computed(() => here.value?.tests || [])
const summary = computed(() => {
  const n = st => tests.value.filter(t => t.status === st).length
  const last = tests.value.map(t => t.at).filter(Boolean).sort().at(-1)
  const running = n('running') > 0 || here.value?.status === 'running'
  return { count: ['done', 'running', 'planned', 'obsolete', 'failed'].filter(st => st !== 'failed' || n(st)).map(st => MARK[st] + n(st)).join(' '), age: ageDays(last), running }
})
const staleDays = computed(() => theme.value.staleDays ?? 2)
const clip = t => t.length > props.budget ? t.slice(0, props.budget - 1) + '…' : t
const over = t => t.length > props.budget
const ORDER = ['building', 'review', 'planned', 'todo', 'idea', 'shipped', 'superseded']
const rows = computed(() => Object.entries(cards.value).filter(([, c]) => c.line || c.needsVerdict || c.missing).map(([link, c]) => ({ link, ...c }))
  .sort((a, b) => Boolean(b.needsVerdict) - Boolean(a.needsVerdict) || ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.title.localeCompare(b.title)))
</script>

<template>
  <div v-if="board" class="pc-board">
    <a v-for="r in rows" :key="r.link" :href="withBase(r.link)" class="pc-row">
      <b :class="['pc-tag', r.status]">{{ r.status || '—' }}</b> <b v-if="r.missing" class="pc-tag bad">missing: {{ r.missing.join(', ') }}</b> <b v-if="r.needsVerdict" class="pc-tag needs">needs verdict</b> <span>{{ r.title }}</span><small> {{ clip(r.line) }}</small>
    </a>
    <p v-if="!rows.length" class="pc-empty">No page has a <code>card-line</code> yet.</p>
  </div>
  <div v-else-if="here" class="pc-card">
    <div v-if="here['superseded-by']" class="pc-super">Superseded by <a :href="withBase(here['superseded-by'])">{{ here['superseded-by'] }}</a>. Kept as history.</div>
    <div class="pc-head"><b :class="['pc-tag', here.status]" v-if="here.status">{{ here.status }}</b><b v-if="here.voted !== undefined" :class="['pc-tag', here.voted ? 'building' : 'needs']" :title="here.voted ? 'All agents agreed in the planning vote' : 'The planning vote has not happened; the page may not start running'">{{ here.voted ? 'voted ✓' : 'not voted' }}</b><b v-if="here.missing" class="pc-tag bad" title="Mandatory card fields are empty">missing: {{ here.missing.join(', ') }}</b><b v-if="here.needsVerdict" class="pc-tag needs" title="Finished, but the Verdict and Learnings sections are missing or empty">needs verdict</b><span v-if="here.line">{{ clip(here.line) }}</span></div>
    <div v-if="here.waitingOn" class="pc-slot"><i>waiting</i><span>{{ here.waitingOn.join(', ') }} have not resolved the open threads</span></div>
    <div v-if="tests.length" class="pc-slot"><i>tests</i><div>
      <div class="pc-count"><b>{{ summary.count }}</b><span v-if="summary.age !== null" :class="{ 'pc-old': summary.running && summary.age > staleDays }"> · last result {{ summary.age ? summary.age + ' d ago' : 'today' }}<template v-if="summary.running && summary.age > staleDays"> ⚠ stale</template></span></div>
      <ul class="pc-tests"><li v-for="t in tests" :key="t.name" :class="['pc-test', t.status]"><span class="pc-mark">{{ MARK[t.status] || '?' }}</span><a v-if="t.link" :href="t.link.startsWith('#') ? t.link : withBase(t.link)" class="pc-link">{{ t.name }}</a><span v-else>{{ t.name }}</span><small><em v-if="t.status === 'planned' || t.status === 'running'" :class="['pc-q', { no: !t.doer }]">{{ t.doer ? `queued #${t.rank}, ${t.doer}${t.after?.length ? ', after ' + t.after.join(', ') : ''}` : 'not queued: no doer' }} </em>{{ t.at || '' }}{{ t.verified ? ' ·run' : '' }}</small></li></ul>
    </div></div>
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
.pc-tag.review { background: #e599f733; color: #9c36b5 }
.pc-tag.planned { background: #fcc41933; color: #a67c00 }
.pc-tag.todo { background: #74c0fc33; color: #1971c2 }
.pc-tag.todo::before { content: '☐ ' }
.pc-tag.needs { background: #ff922b44; color: #d9480f }
.pc-tag.bad { background: #e0313122; color: #c92a2a }
.pc-count { font-size: 13px }
.pc-mark, .pc-count b { font-family: "DejaVu Sans", "Noto Sans Symbols 2", sans-serif }
.vp-doc .pc-tests { list-style: none; margin: 4px 0 0; padding: 0 }
.vp-doc .pc-tests li { margin: 0 }
.pc-test { display: grid; grid-template-columns: 18px 1fr auto; gap: 6px; padding: 1px 0; font-size: 13px }
.pc-test small { color: var(--vp-c-text-3) } .pc-q { font-style: normal; color: var(--vp-c-brand-1) } .pc-q.no { color: #e03131 }
.vp-doc .pc-link { color: inherit; text-decoration: underline dotted; text-underline-offset: 2px } .vp-doc .pc-link:hover { color: var(--vp-c-brand-1) }
.pc-test.done .pc-mark { color: #2b8a3e } .pc-test.running .pc-mark { color: #1c7ed6 } .pc-test.failed .pc-mark { color: #e03131 } .pc-test.obsolete { color: var(--vp-c-text-3); text-decoration: line-through }
.pc-old { color: #d9480f; font-weight: 600 }
.pc-tag.idea { background: #74c0fc33; color: #1c7ed6 }
.pc-board { display: flex; flex-direction: column; gap: 4px; margin: 12px 0; font-size: 14px }
.pc-row { display: block; padding: 4px 10px; border: 1px solid var(--vp-c-divider); border-radius: 6px; text-decoration: none; color: var(--vp-c-text-1) }
.pc-row small { margin-left: 8px; color: var(--vp-c-text-2); font-size: 13px }
.pc-super { margin-bottom: 8px; padding: 4px 8px; border-radius: 4px; background: #adb5bd33; font-size: 13px }
</style>
