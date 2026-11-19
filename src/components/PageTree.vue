<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useData, useRouter, withBase } from 'vitepress'

defineProps({ pad: Boolean })
const { theme, page } = useData()
const router = useRouter()
const pages = computed(() => theme.value.pageTree || [])
const current = computed(() => page.value.relativePath.replace(/\.md$/, ''))
const bySlug = computed(() => Object.fromEntries(pages.value.map(p => [p.slug, p])))
const childrenOf = slug => pages.value.filter(p => p.parent === slug)
const trail = computed(() => {
  const out = []
  let p = bySlug.value[current.value]
  for (let i = 0; p && p.parent && i < 20; i++) { p = bySlug.value[p.parent]; if (p) out.unshift(p) }
  return out
})
const TENSE = { past: 'History: how we got here', present: 'Now: how things are', future: 'Plan: not built yet' }
const stale = p => p?.tense === 'present' && p.asOf && (Date.now() - Date.parse(p.asOf)) / 864e5 > (theme.value.staleDays ?? 2)
const tenseTitle = p => p.tense ? TENSE[p.tense] + (stale(p) ? ` (as of ${p.asOf}, may be stale)` : '') : undefined
const children = computed(() => childrenOf(current.value))
const hasTree = computed(() => pages.value.some(p => p.parent))

const awaiting = ref({})
const waits = slug => awaiting.value[slug === 'index' ? '/' : '/' + slug] || 0
const openBy = ref({})
const opens = slug => openBy.value[slug === 'index' ? '/' : '/' + slug] || 0
const viewed = ref({})
const newTitle = slug => changed(slug) === 'new' ? 'New page since your last visit' : 'Changed since your last visit'
const changed = slug => viewed.value[bySlug.value[slug]?.link]
const onViewed = e => { viewed.value = e.detail?.pages || {} }
const tints = ref({})
const hidden = slug => descendants(slug).reduce((n, d) => n + waits(d), 0)
const hiddenTint = slug => { const d = descendants(slug).find(x => waits(x)); return d ? tint(d) : undefined }
const onAwait = e => { awaiting.value = e.detail?.pages || {}; openBy.value = e.detail?.open || {}; tints.value = Object.fromEntries(Object.entries(e.detail?.colors || {}).map(([k, v]) => [k, `rgb(${e.detail.palette?.[v] || '255,90,79'})`])) }
const tint = slug => { const c = tints.value[slug === 'index' ? '/' : '/' + slug]; return c ? { background: c } : undefined }
const tintAll = computed(() => { const v = Object.values(tints.value); return v.length ? { background: v[0] } : undefined })
const open = ref(false)
const cursor = ref(0)
const reveal = () => nextTick(() => list.value?.querySelector('.pt-row.at')?.scrollIntoView({ block: 'nearest' }))
const collapsed = ref(new Set())
const list = ref(null)
watch(cursor, reveal)
// Export selection: only in the live preview (exported copies have no export endpoint).
const canExport = typeof window !== 'undefined' && !window.__ADR_FILES
const picked = ref(new Set())
const selecting = ref(false)
let pendingZ = false
const descendants = slug => childrenOf(slug).flatMap(c => [c.slug, ...descendants(c.slug)])
function pick(row, withChildren = false) {
  const next = new Set(picked.value)
  const group = withChildren ? [row.slug, ...descendants(row.slug)] : [row.slug]
  if (next.has(row.slug)) group.forEach(s => next.delete(s)); else group.forEach(s => next.add(s))
  picked.value = next
}
function runExport() {
  const links = pages.value.filter(p => picked.value.has(p.slug) && !p.virtual).map(p => p.link)
  if (!links.length) return
  open.value = false
  document.dispatchEvent(new CustomEvent('adr-export', { detail: { pages: links } }))
}

const rows = computed(() => {
  const out = []
  const walk = (parent, depth) => {
    for (const p of childrenOf(parent)) {
      out.push({ ...p, depth, kids: childrenOf(p.slug).length })
      if (!collapsed.value.has(p.slug)) walk(p.slug, depth + 1)
    }
  }
  walk(null, 0)
  return out
})

function go(link) { open.value = false; router.go(withBase(link)) }
function goNewTab(link) { window.open(withBase(link), '_blank', 'noopener') }
const rowClick = (e, link) => (e.ctrlKey || e.metaKey ? goNewTab(link) : go(link))
function show() {
  open.value = true
  cursor.value = Math.max(0, rows.value.findIndex(r => r.slug === current.value))
  nextTick(() => list.value && list.value.focus())
  reveal()
}
function foldAll(shut) {
  const row = rows.value[cursor.value]
  let top = row
  while (top && top.parent && bySlug.value[top.parent]) top = bySlug.value[top.parent]
  collapsed.value = shut ? new Set(pages.value.filter(p => childrenOf(p.slug).length).map(p => p.slug)) : new Set()
  if (shut && top) cursor.value = Math.max(0, rows.value.findIndex(r => r.slug === top.slug))
}
function foldBelow(row, shut) {
  const next = new Set(collapsed.value)
  for (const slug of [row.slug, ...descendants(row.slug)]) {
    if (shut && childrenOf(slug).length) next.add(slug); else if (!shut) next.delete(slug)
  }
  collapsed.value = next
}
function fold(row, shut) {
  const next = new Set(collapsed.value)
  if (shut) next.add(row.slug); else next.delete(row.slug)
  collapsed.value = next
}

let graphActive = false
const onMode = e => { graphActive = Boolean(e.detail?.mode) }
function onKey(e) {
  if (e.ctrlKey || e.metaKey || e.altKey || !hasTree.value) return
  const t = e.composedPath?.()[0] || e.target
  if (t.matches?.('input,textarea,select,[contenteditable]')) return
  if (open.value) {
    const k = e.key
    const row = rows.value[cursor.value]
    if (pendingZ) {
      pendingZ = false
      if (row && row.kids && (k === 'c' || k === 'o')) foldBelow(row, k === 'c')
    } else if (k === 'z') pendingZ = true
    else if (k === 'Escape' && selecting.value) selecting.value = false
    else if (k === 'Escape' || k === 't') { open.value = false; selecting.value = false }
    else if (k === 'j' || k === 'ArrowDown') cursor.value = Math.min(rows.value.length - 1, cursor.value + 1)
    else if (k === 'k' || k === 'ArrowUp') cursor.value = Math.max(0, cursor.value - 1)
    else if (k === 'Enter' && row) go(row.link)
    else if (k === 'o' && row) goNewTab(row.link)
    else if (k === 'h' && row && row.kids) fold(row, true)
    else if (k === 'l' && row && row.kids) fold(row, false)
    else if (k === 'H') foldAll(true)
    else if (k === 'L') foldAll(false)
    else if (k === 'v' && canExport) selecting.value = !selecting.value
    else if ((k === ' ' || k === 'x') && row && selecting.value) pick(row)
    else if (k === 'X' && row && selecting.value) pick(row, true)
    else if (k === 'a' && selecting.value) picked.value = new Set(rows.value.map(r => r.slug))
    else if (k === 'A' && selecting.value) picked.value = new Set()
    else if (k === 'e' && selecting.value) runExport()
    else return
    e.preventDefault(); e.stopPropagation()
    return
  }
  if (e.key === 't' && !graphActive && localStorage.getItem('preview-comments-vim') !== 'off') { e.preventDefault(); show() }
}
onMounted(() => {
  window.addEventListener('keydown', onKey, true)
  document.addEventListener('preview-comment-mode', onMode)
  document.addEventListener('preview-comment-awaiting', onAwait)
  document.addEventListener('preview-comment-viewed', onViewed)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey, true)
  document.removeEventListener('preview-comment-mode', onMode)
  document.removeEventListener('preview-comment-awaiting', onAwait)
  document.removeEventListener('preview-comment-viewed', onViewed)
})
</script>

<template>
<div v-if="hasTree && bySlug[current]" class="pt-bar" :class="{ pad }">
  <nav v-if="trail.length" class="pt-crumbs" aria-label="Breadcrumb">
    <template v-for="p in trail" :key="p.slug"><a :href="withBase(p.link)">{{ p.title }}</a><b v-if="waits(p.slug)" class="pt-dot" :style="tint(p.slug)" title="Threads with something new for you">{{ waits(p.slug) }}</b><i v-if="changed(p.slug)" class="pt-new" :title="newTitle(p.slug)"></i><span>›</span></template>
    <strong>{{ bySlug[current].title }}</strong><em v-if="bySlug[current].tense" :class="['pt-tense', 'tense-' + bySlug[current].tense]" :title="tenseTitle(bySlug[current])">{{ bySlug[current].tense }}{{ stale(bySlug[current]) ? ' · may be stale' : '' }}</em><b v-if="waits(current)" class="pt-dot" :style="tint(current)" title="Threads with something new for you">{{ waits(current) }}</b><i v-if="changed(current)" class="pt-new" :title="newTitle(current)"></i>
  </nav>
  <span v-if="children.length" class="pt-children">
    Pages below: <a v-for="c in children" :key="c.slug" :href="withBase(c.link)">{{ c.title }}<b v-if="waits(c.slug)" class="pt-dot" :style="tint(c.slug)">{{ waits(c.slug) }}</b><i v-if="changed(c.slug)" class="pt-new" :title="newTitle(c.slug)"></i></a>
  </span>
  <button class="pt-open" title="Page tree (t)" @click="open ? (open = false) : show()">☰ Tree<b v-if="Object.keys(awaiting).length" class="pt-dot" :style="tintAll" title="Threads with something new for you">{{ Object.values(awaiting).reduce((a, b) => a + b, 0) }}</b></button>
  <div v-if="open" class="pt-pop" ref="list" tabindex="0" role="tree">
    <div class="pt-tools">
      <button tabindex="-1" title="Collapse every subtree (H)" @click="foldAll(true)">Collapse all</button>
      <button tabindex="-1" title="Expand every subtree (L)" @click="foldAll(false)">Expand all</button>
      <button v-if="canExport" tabindex="-1" :class="{ on: selecting }" title="Select pages to export (v)" @click="selecting = !selecting">{{ selecting ? 'Done selecting' : 'Select' }}</button>
      <span v-if="selecting" class="pt-mode">-- SELECT --</span>
    </div>
    <div v-for="(r, i) in rows" :key="r.slug" class="pt-row" :class="[{ cur: r.slug === current, at: i === cursor }, r.tense && 'tense-' + r.tense]" :title="tenseTitle(r)"
      :style="{ paddingLeft: 10 + r.depth * 18 + 'px' }" role="treeitem" @click="rowClick($event, r.link)" @auxclick.middle.prevent="goNewTab(r.link)">
      <button v-if="r.kids" class="pt-fold" tabindex="-1" @click.stop="fold(r, !collapsed.has(r.slug))">{{ collapsed.has(r.slug) ? '▸' : '▾' }}</button>
      <span v-else class="pt-fold"></span><input v-if="selecting" type="checkbox" class="pt-check" tabindex="-1" :checked="picked.has(r.slug)" title="Select this page for export" @click.stop="pick(r)">{{ r.title }}<em v-if="theme.cards?.[r.link]?.missing" class="pt-tense pt-bad" :title="'Card is missing: ' + theme.cards[r.link].missing.join(', ')">card incomplete</em><em v-if="r.needsVerdict" class="pt-tense pt-verdict" title="Finished, but no Verdict and Learnings yet">needs verdict</em><button v-if="selecting && r.kids" class="pt-kids" tabindex="-1" title="Select or clear this page and all pages below it" @click.stop="pick(r, true)">+ below</button><b v-if="waits(r.slug)" class="pt-dot" :style="tint(r.slug)" title="Threads with something new for you">{{ waits(r.slug) }}</b><i v-if="changed(r.slug)" class="pt-new" :title="newTitle(r.slug)"></i><b v-if="opens(r.slug)" class="pt-ring" title="Open threads waiting on the agent">{{ opens(r.slug) }}</b><b v-if="collapsed.has(r.slug) && hidden(r.slug)" class="pt-dot" :style="hiddenTint(r.slug)" title="Something new on pages folded below">↓{{ hidden(r.slug) }}</b>
    </div>
    <div v-if="selecting" class="pt-export">
      <button :disabled="!picked.size" @click="runExport">Export {{ picked.size || '' }} selected</button>
    </div>
    <div class="pt-hint">{{ selecting ? 'Space tick · X tick with pages below · a/A all/none · e export · v/Esc stop selecting' : `j/k move · Enter open · o new tab · h/l fold · zc/zo fold below · H/L all${canExport ? ' · v select' : ''} · t/Esc close` }}</div>
  </div>
</div>
</template>

<style scoped>
.pt-tools { display: flex; gap: 6px; align-items: center; padding: 2px 12px 6px; }
.pt-tools button { font-size: 11px; padding: 1px 8px; border: 1px solid var(--vp-c-divider); border-radius: 999px; background: none; color: var(--vp-c-text-2); cursor: pointer; }
.pt-tools button.on { color: var(--vp-c-brand-1); border-color: var(--vp-c-brand-1); }
.pt-mode { margin-left: auto; font: 700 11px ui-monospace, monospace; color: #74c0fc; }
.pt-bar { position: relative; display: flex; flex-wrap: wrap; align-items: center; gap: 14px; padding: 6px 0 10px; margin-bottom: 8px; font-size: 13px; border-bottom: 1px solid var(--vp-c-divider); }
.pt-bar.pad { padding: 8px 16px; }
.pt-crumbs { display: flex; gap: 6px; align-items: center; }
.pt-crumbs span { opacity: .5; }
.pt-children { display: flex; gap: 10px; flex-wrap: wrap; opacity: .85; }
.pt-bar a { text-decoration: none; color: var(--vp-c-brand-1); }
.pt-open { margin-left: auto; padding: 2px 10px; border: 1px solid var(--vp-c-divider); border-radius: 8px; font-size: 12px; }
.pt-pop { position: absolute; top: 100%; right: 0; z-index: 40; min-width: 260px; max-height: 60vh; overflow: auto; padding: 6px 0; background: var(--vp-c-bg-elv); border: 1px solid var(--vp-c-divider); border-radius: 10px; box-shadow: 0 8px 30px #0008; outline: none; }
.pt-row { display: flex; gap: 4px; align-items: center; padding: 4px 12px; cursor: pointer; }
.pt-row.tense-past { border-left: 3px solid #868e96; opacity: .8 }
.pt-row.tense-present { border-left: 3px solid #51cf66 }
.pt-row.tense-future { border-left: 3px solid #74c0fc }
.pt-tense { font-style: normal; font-size: 11px; text-transform: uppercase; margin-left: 8px; padding: 0 6px; border-radius: 4px; background: var(--vp-c-default-soft) }
.pt-verdict { background: #ff922b44; color: #d9480f }
.pt-bad { background: #e0313122; color: #c92a2a }
.pt-tense.tense-present { background: #51cf6633 } .pt-tense.tense-future { background: #74c0fc33 } .pt-tense.tense-past { background: #adb5bd44 }
.pt-row.cur { font-weight: 700; color: var(--vp-c-brand-1); }
.pt-row.at { background: var(--vp-c-default-soft); }
.pt-new { display: inline-block; width: 8px; height: 8px; margin-left: 6px; border-radius: 50%; background: #4dabf7; vertical-align: middle; }
.pt-ring { margin-left: 6px; padding: 0 5px; border-radius: 999px; border: 1px solid var(--vp-c-text-2); color: var(--vp-c-text-2); font-size: 11px; }
.pt-dot { margin-left: 6px; padding: 0 6px; border-radius: 999px; background: #e03131; color: #1b1b1f; font-size: 11px; }
.pt-fold { width: 16px; font-size: 11px; opacity: .7; }
.pt-check { margin: 0 4px 0 2px; accent-color: var(--vp-c-brand-1); }
.pt-kids { margin-left: auto; padding: 0 6px; border: 1px solid var(--vp-c-divider); border-radius: 6px; font-size: 11px; opacity: .8; }
.pt-export { padding: 6px 12px 0; }
.pt-export button { padding: 2px 10px; border: 1px solid var(--vp-c-divider); border-radius: 8px; font-size: 12px; }
.pt-export button:disabled { opacity: .4; cursor: default; }
.pt-hint { padding: 6px 12px 2px; font-size: 11px; opacity: .55; font-family: monospace; }
</style>
