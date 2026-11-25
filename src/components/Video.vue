<script setup>
// The slot for a run's video, placed where it will show. A card test `kind: video` with `video: {run}` names the run;
// the slot shows "video missing" until that run's manifest lists a video file, then plays it. Ticking the card is
// tools/verify_checks.py.
// While it plays or seeks, the plots of the same run follow it with a cursor.
import { computed, onMounted, onUnmounted, ref } from "vue"
import { useData, withBase } from "vitepress"

const props = defineProps({ test: { type: String, required: true }, base: { type: String, default: "http://127.0.0.1:8766" } })
const { frontmatter, page } = useData()
const t = computed(() => (frontmatter.value.card?.tests || []).find((x) => x.id === props.test))
const v = computed(() => t.value?.video)
const experiment = computed(() => v.value?.experiment || page.value.relativePath.split("/").pop().replace(/\.md$/, ""))
const item = ref(null), phase = ref(""), root = ref(props.base)
let timer = null, busy = false

// The plots of the same run draw a cursor at this fraction of the video (see Plot.vue).
function tick(e) {
  const d = e.target.duration
  if (d > 0) window.dispatchEvent(new CustomEvent("run-tick", { detail: { run: v.value.run, frac: e.target.currentTime / d } }))
}

async function load() {
  if (!v.value || busy) return
  busy = true
  try {
    let runs
    try {
      runs = await (await fetch(`${props.base}/runs`, { cache: "no-store" })).json()
      root.value = props.base
    } catch {
      // no catalog reachable (the published site): the exported copy of the finished runs
      runs = await (await fetch(withBase("/data/runs/index.json"))).json()
      root.value = withBase("")
    }
    const run = runs.find((m) => m.experiment === experiment.value && m.run === v.value.run)
    phase.value = run?.progress?.phase || ""
    item.value = run?.items.find((i) => i.kind === "video" && (!v.value.file || i.file === v.value.file)) || null
    if (item.value) clearInterval(timer)
  } catch { item.value = null } finally { busy = false }
}
onMounted(() => { load(); timer = setInterval(load, 5000) })
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <div class="run-video" :class="{ missing: !item }">
    <div v-if="!v" class="warn">Test “{{ test }}” has no <code>video: {run}</code> in the front matter.</div>
    <video v-else-if="item" :src="root + item.url" controls preload="metadata" @timeupdate="tick" @seeked="tick" />
    <div v-else>
      <b>Video missing:</b> run <code>{{ v.run }}</code> has not reported a video file{{ phase ? ` (phase ${phase})` : " (no data yet)" }}.
      The job must record it as part of the run: camera, ground truth and estimate, rendered view, on one tick axis.
    </div>
  </div>
</template>

<style scoped>
.run-video { border: 1px solid #475569; border-left-width: 4px; border-left-color: #22c55e; border-radius: 4px; padding: 8px 12px; margin: 12px 0 }
.run-video.missing { border-left-color: #ef4444 }
video { width: 100%; max-height: 480px }
.warn { color: #f87171 }
</style>
