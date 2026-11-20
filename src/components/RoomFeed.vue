<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'

// Every mesh room, read-only: topic, members, times, the pinned SUMMARY: post and the last 20 posts. Viewing marks nothing read.
// A post starting "SUMMARY:" is pinned (latest wins); a post starting "CLOSED:" closes the room.
const rooms = ref([])
const error = ref('')
const showClosed = ref(false)
let timer
const load = async () => {
  try {
    const r = await fetch('/__preview_comments/rooms', { headers: { 'X-Preview-Comment': '1' } })
    const j = await r.json()
    rooms.value = j.rooms ?? []
    error.value = j.error ?? ''
  } catch { error.value = 'Rooms are only shown on the live preview.' }
}
onMounted(() => { load(); timer = setInterval(load, 15000) })
onUnmounted(() => clearInterval(timer))
const shown = computed(() => rooms.value.filter(r => showClosed.value || !r.closed))
const closedCount = computed(() => rooms.value.filter(r => r.closed).length)
const when = t => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <div class="rf">
    <p v-if="error" class="rf-note">{{ error }}</p>
    <label v-if="closedCount" class="rf-toggle"><input v-model="showClosed" type="checkbox" /> show {{ closedCount }} closed</label>
    <p v-if="!shown.length && !error" class="rf-note">No open rooms.</p>
    <details v-for="r in shown" :key="r.id" class="rf-room" :open="!r.closed">
      <summary>
        <b>{{ r.topic }}</b>
        <span class="rf-state" :class="{ closed: r.closed }">{{ r.closed ? 'closed ' + when(r.closed.at) : 'open since ' + when(r.opened) }}</span>
      </summary>
      <p class="rf-members">{{ r.members.join(', ') }}</p>
      <blockquote v-if="r.summary" class="rf-summary"><b>Summary</b> ({{ r.summary.from }}, {{ when(r.summary.at) }})<br />{{ r.summary.text }}</blockquote>
      <p v-else class="rf-note">No pinned summary yet.</p>
      <p v-if="r.postCount > r.posts.length" class="rf-note">Last {{ r.posts.length }} of {{ r.postCount }} posts</p>
      <ul class="rf-posts">
        <li v-for="p in r.posts" :key="p.id"><span class="rf-meta">{{ when(p.at) }} · {{ p.from }}</span> {{ p.content }}</li>
      </ul>
    </details>
  </div>
</template>

<style scoped>
.rf-room { border: 1px solid var(--vp-c-divider); border-radius: 6px; padding: 6px 10px; margin: 8px 0; }
.rf-state { margin-left: 8px; font-size: 12px; color: var(--vp-c-green-1, #3a7); }
.rf-state.closed, .rf-note, .rf-meta, .rf-members { color: var(--vp-c-text-2); }
.rf-note, .rf-members { font-size: 13px; margin: 4px 0; }
.rf-summary { margin: 6px 0; padding: 4px 10px; border-left: 3px solid var(--vp-c-brand-1); white-space: pre-wrap; }
.rf-posts { list-style: none; padding: 0; margin: 4px 0; }
.rf-posts li { padding: 3px 0; border-top: 1px solid var(--vp-c-divider); white-space: pre-wrap; font-size: 13px; }
.rf-meta { font-size: 11px; display: block; }
</style>
