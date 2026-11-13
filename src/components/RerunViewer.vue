<script setup>
import { computed, ref, onMounted } from 'vue'

// <RerunViewer src="https://…/x.rrd" /> or src="/runs/x.rrd" (served from public/); hosted web viewer in an iframe.
const props = defineProps({
  src: { type: String, required: true },
  height: { type: [String, Number], default: 560 },
  version: { type: String, default: 'latest' },
})
const origin = ref('')
onMounted(() => { origin.value = location.origin })
const url = computed(() => {
  if (!/^https?:/.test(props.src) && !origin.value) return ''
  const rrd = new URL(props.src, origin.value || undefined).href
  return `https://app.rerun.io/version/${encodeURIComponent(props.version)}/?url=${encodeURIComponent(rrd)}&theme=dark`
})
const h = computed(() => typeof props.height === 'number' ? `${props.height}px` : props.height)
</script>

<template>
  <div class="rerun-viewer" :style="{ height: h }">
    <iframe v-if="url" :src="url" title="Rerun viewer" allow="fullscreen; clipboard-write" loading="lazy"></iframe>
  </div>
</template>

<style scoped>
.rerun-viewer { width: 100%; margin: 16px 0; border: 1px solid var(--vp-c-divider); border-radius: 8px; overflow: hidden; background: #0d1117 }
.rerun-viewer iframe { width: 100%; height: 100%; border: 0; display: block }
</style>
