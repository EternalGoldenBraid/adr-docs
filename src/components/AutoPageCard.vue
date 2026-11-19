<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useData } from 'vitepress'
import PageCard from './PageCard.vue'

// Puts the page's card directly under its title (the h1 lives inside the Markdown content, which no layout slot can reach), unless the page placed <PageCard /> itself.
const { theme, page } = useData()
const target = ref(null)
let holder

function place() {
  holder?.remove()
  holder = null
  target.value = null
  const slug = page.value.relativePath.replace(/\.md$/, '')
  const link = slug === 'index' ? '/' : '/' + slug.split('/').map(encodeURIComponent).join('/')
  const card = (theme.value.cards || {})[link]
  const h1 = document.querySelector('.vp-doc h1')
  if (!card || !h1 || document.querySelector('.vp-doc .pc-card')) return
  holder = document.createElement('div')
  holder.className = 'pc-auto'
  h1.after(holder)
  target.value = holder
}

onMounted(() => setTimeout(place, 50))
watch(() => page.value.relativePath, () => nextTick(() => setTimeout(place, 50)))
onBeforeUnmount(() => holder?.remove())
</script>

<template>
  <Teleport v-if="target" :to="target"><PageCard /></Teleport>
</template>
