<script setup>
// The dataset a ticket runs on: its front matter `data: <experiment>/<run>` as a link to that catalog entry, with
// whether the catalog holds it. Place it under the page title.
import { computed, onMounted, ref } from "vue"
import { useData } from "vitepress"

const props = defineProps({ base: { type: String, default: "http://127.0.0.1:8766" } })
const { frontmatter } = useData()
const data = computed(() => frontmatter.value.data)
const found = ref(null)
const url = computed(() => `${props.base}/runs/${data.value}`)
onMounted(async () => {
  if (!data.value) return
  try { found.value = (await fetch(url.value, { cache: "no-store" })).ok } catch { found.value = false }
})
</script>

<template>
  <p v-if="data" class="data-link">
    <b>Data:</b> <a :href="url" target="_blank" rel="noopener"><code>{{ data }}</code></a>
    <span v-if="found === false" class="miss"> not in the catalog (or the catalog is not reachable)</span>
  </p>
  <p v-else-if="frontmatter.nodata" class="data-link"><b>Data:</b> none, {{ frontmatter.nodata }}</p>
  <p v-else class="miss">This page declares no dataset (<code>data:</code> in the front matter).</p>
</template>

<style scoped>
.data-link { margin: 8px 0 }
.miss { color: #f87171 }
</style>
