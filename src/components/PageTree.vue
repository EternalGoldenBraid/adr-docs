<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
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
const children = computed(() => childrenOf(current.value))
const hasTree = computed(() => pages.value.some(p => p.parent))

const awaiting = ref({})
const waits = slug => awaiting.value[slug === 'index' ? '/' : '/' + slug] || 0
const onAwait = e => { awaiting.value = e.detail?.pages || {} }
const open = ref(false)
const cursor = ref(0)
const collapsed = ref(new Set())
const list = ref(null)

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
function show() {
  open.value = true
  cursor.value = Math.max(0, rows.value.findIndex(r => r.slug === current.value))
  nextTick(() => list.value && list.value.focus())
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
    if (k === 'Escape' || k === 't') open.value = false
    else if (k === 'j' || k === 'ArrowDown') cursor.value = Math.min(rows.value.length - 1, cursor.value + 1)
    else if (k === 'k' || k === 'ArrowUp') cursor.value = Math.max(0, cursor.value - 1)
    else if (k === 'Enter' && row) go(row.link)
    else if (k === 'h' && row && row.kids) fold(row, true)
    else if (k === 'l' && row && row.kids) fold(row, false)
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
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey, true)
  document.removeEventListener('preview-comment-mode', onMode)
  document.removeEventListener('preview-comment-awaiting', onAwait)
})
</script>

<template>
<div v-if="hasTree && bySlug[current]" class="pt-bar" :class="{ pad }">
  <nav v-if="trail.length" class="pt-crumbs" aria-label="Breadcrumb">
    <template v-for="p in trail" :key="p.slug"><a :href="withBase(p.link)">{{ p.title }}</a><b v-if="waits(p.slug)" class="pt-dot" title="Agent awaits you">{{ waits(p.slug) }}</b><span>›</span></template>
    <strong>{{ bySlug[current].title }}</strong><b v-if="waits(current)" class="pt-dot" title="Agent awaits you">{{ waits(current) }}</b>
  </nav>
  <span v-if="children.length" class="pt-children">
    Pages below: <a v-for="c in children" :key="c.slug" :href="withBase(c.link)">{{ c.title }}<b v-if="waits(c.slug)" class="pt-dot">{{ waits(c.slug) }}</b></a>
  </span>
  <button class="pt-open" title="Page tree (t)" @click="open ? (open = false) : show()">☰ Tree<b v-if="Object.keys(awaiting).length" class="pt-dot" title="Open threads the agent started and is waiting on you for">{{ Object.values(awaiting).reduce((a, b) => a + b, 0) }}</b></button>
  <div v-if="open" class="pt-pop" ref="list" tabindex="0" role="tree">
    <div v-for="(r, i) in rows" :key="r.slug" class="pt-row" :class="{ cur: r.slug === current, at: i === cursor }"
      :style="{ paddingLeft: 10 + r.depth * 18 + 'px' }" role="treeitem" @click="go(r.link)">
      <button v-if="r.kids" class="pt-fold" tabindex="-1" @click.stop="fold(r, !collapsed.has(r.slug))">{{ collapsed.has(r.slug) ? '▸' : '▾' }}</button>
      <span v-else class="pt-fold"></span>{{ r.title }}<b v-if="waits(r.slug)" class="pt-dot" title="Agent awaits you">{{ waits(r.slug) }}</b>
    </div>
    <div class="pt-hint">j/k move · Enter open · h/l fold · t/Esc close</div>
  </div>
</div>
</template>

<style scoped>
.pt-bar { position: relative; display: flex; flex-wrap: wrap; align-items: center; gap: 14px; padding: 6px 0 10px; margin-bottom: 8px; font-size: 13px; border-bottom: 1px solid var(--vp-c-divider); }
.pt-bar.pad { padding: 8px 16px; }
.pt-crumbs { display: flex; gap: 6px; align-items: center; }
.pt-crumbs span { opacity: .5; }
.pt-children { display: flex; gap: 10px; flex-wrap: wrap; opacity: .85; }
.pt-bar a { text-decoration: none; color: var(--vp-c-brand-1); }
.pt-open { margin-left: auto; padding: 2px 10px; border: 1px solid var(--vp-c-divider); border-radius: 8px; font-size: 12px; }
.pt-pop { position: absolute; top: 100%; right: 0; z-index: 40; min-width: 260px; max-height: 60vh; overflow: auto; padding: 6px 0; background: var(--vp-c-bg-elv); border: 1px solid var(--vp-c-divider); border-radius: 10px; box-shadow: 0 8px 30px #0008; outline: none; }
.pt-row { display: flex; gap: 4px; align-items: center; padding: 4px 12px; cursor: pointer; }
.pt-row.cur { font-weight: 700; color: var(--vp-c-brand-1); }
.pt-row.at { background: var(--vp-c-default-soft); }
.pt-dot { margin-left: 6px; padding: 0 6px; border-radius: 999px; background: #e03131; color: #fff; font-size: 11px; }
.pt-fold { width: 16px; font-size: 11px; opacity: .7; }
.pt-hint { padding: 6px 12px 2px; font-size: 11px; opacity: .55; font-family: monospace; }
</style>
