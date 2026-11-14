<script setup>
import { onMounted, watch, nextTick } from 'vue'
import { useData, useRoute } from 'vitepress'

// Adds a status chip (status, owner, step progress) after links that point at a workstream page.
const { theme } = useData()
const route = useRoute()
function decorate() {
  const board = theme.value.workstreams || {}
  for (const a of document.querySelectorAll('.vp-doc a[href]')) {
    if (a.dataset.wsChip || a.closest('.wsb')) continue
    const id = /(?:^|\/)workstreams\/([^/#?]+?)(?:\.html|\.md)?(?:[#?].*)?$/.exec(a.getAttribute('href'))?.[1]
    const ws = id && board[id]
    if (!ws) continue
    a.dataset.wsChip = '1'
    a.classList.add('ws-link')
    const chip = document.createElement('span')
    chip.className = `ws-chip ws-${ws.status}`
    chip.textContent = [ws.status, ws.owner, ws.total ? `${ws.done}/${ws.total}` : ''].filter(Boolean).join(' · ')
    a.after(chip)
  }
}
onMounted(() => { decorate(); new MutationObserver(() => decorate()).observe(document.body, { childList: true, subtree: true }) })
watch(() => route.path, () => nextTick(decorate))
</script>

<template><span hidden></span></template>

<style>
.ws-chip { display: inline-block; margin-left: 6px; padding: 0 8px; border-radius: 999px; font-size: 11px; font-weight: 600; line-height: 18px; vertical-align: middle;
  background: var(--vp-c-default-soft); color: var(--vp-c-text-2); border: 1px solid var(--vp-c-divider) }
.ws-chip.ws-active { background: #1f6feb33; color: #79b8ff; border-color: #1f6feb }
.ws-chip.ws-queued, .ws-chip.ws-proposed { background: #9e6a0333; color: #e3b341; border-color: #9e6a03 }
.ws-chip.ws-blocked { background: #da363333; color: #ff7b72; border-color: #da3633 }
.ws-chip.ws-done { background: #23863633; color: #7ee787; border-color: #238636 }
.ws-link { font-weight: 600 }
</style>
