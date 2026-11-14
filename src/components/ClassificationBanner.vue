<script setup>
import { computed } from 'vue'
import { useData } from 'vitepress'

// Set once in the root index.md (`classification:` and `classification-level:`); no page can hide it.
const { theme } = useData()
const banner = computed(() => theme.value.classification)
</script>

<template>
<template v-if="banner">
  <component :is="'style'">:root { --vp-layout-top-height: 22px; }</component>
  <div class="adr-class" :class="banner.level" role="note">{{ banner.label }}</div>
</template>
</template>

<style>
.adr-class { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; height: 22px; line-height: 22px; text-align: center;
  font: 600 11px/22px var(--vp-font-family-base, sans-serif); letter-spacing: .06em; text-transform: uppercase; color: #fff; pointer-events: none; }
.adr-class.restricted { background: #c92a2a; }
.adr-class.internal { background: #b8860b; }
.adr-class.public { background: #2b8a3e; }
@media print { .adr-class { position: static; } }
</style>
