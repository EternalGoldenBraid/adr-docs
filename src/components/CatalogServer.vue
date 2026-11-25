<script setup>
// Status and start/stop of the local Rerun catalog server, through the dev server's /__catalog endpoint.
import { onMounted, ref } from "vue"
import RerunViewer from "./RerunViewer.vue"

const state = ref("checking"), busy = ref(false), msg = ref(""), ours = ref(false), viewer = ref(0), opened = ref(false)

async function call(path = "", method = "GET") {
  const r = await fetch(`/__catalog${path}`, { method })
  if (!(r.headers.get("content-type") || "").includes("json")) throw new Error("no endpoint")
  const j = await r.json()
  if (!r.ok) throw new Error(j.error || r.status)
  return j
}
async function refresh() {
  try { const j = await call(); state.value = j.up ? "up" : "down"; ours.value = j.ours }
  catch { state.value = "static" }
}
async function act(what) {
  busy.value = true; msg.value = what === "start" ? "starting (indexes the recordings first)…" : "stopping…"
  try { const j = await call(`/${what}`, "POST"); msg.value = ""; if (j.started) viewer.value++ }
  catch (e) { msg.value = e.message }
  busy.value = false; await refresh()
}
// Reconnect: re-check the server and restart the viewer, which does not recover from a server restart itself.
// In the preview the dev server proxies the catalog, so the viewer stays on this origin.
const src = () => (state.value === "up" ? `rerun+http://${location.host}` : "rerun+http://127.0.0.1:51234")
async function reconnect() {
  busy.value = true; msg.value = "checking…"
  await refresh(); viewer.value++
  busy.value = false; msg.value = `checked ${new Date().toLocaleTimeString([], { hour12: false })}`
}
onMounted(refresh)
</script>

<template>
  <div class="cs">
    <span class="dot" :class="state" />
    <span v-if="state === 'up'">Catalog server running on <code>rerun+http://127.0.0.1:51234</code></span>
    <span v-else-if="state === 'down'">Catalog server stopped</span>
    <span v-else-if="state === 'static'">No start/stop on this server (published site); start it from the project.</span>
    <span v-else>checking…</span>
    <button v-if="state === 'down'" :disabled="busy" @click="act('start')">Start</button>
    <button v-if="state === 'up' && ours" :disabled="busy" @click="act('stop')">Stop</button>
    <button v-if="state !== 'static'" :disabled="busy" title="re-check the server and reconnect the viewer" @click="reconnect">↻ Reconnect</button>
    <span v-if="msg" class="msg" :class="{ ok: msg.startsWith('checked') }">{{ msg }}</span>
  </div>
  <RerunViewer v-if="state === 'up' || state === 'static'" :key="viewer" :autoopen="opened" @opened="opened = true" :src="src()" height="620px" label="Browse the catalog server" />
</template>

<style scoped>
.cs { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 10px 0; color: #cbd5e1 }
.dot { width: 10px; height: 10px; border-radius: 50%; background: #64748b }
.dot.up { background: #4ade80 } .dot.down { background: #f87171 }
.cs button { background: #1e293b; color: #e5e7eb; border: 1px solid #334155; border-radius: 5px; padding: 2px 10px; cursor: pointer }
.cs button:disabled { opacity: 0.5; cursor: default }
.msg { color: #fbbf24 }
.msg.ok { color: #94a3b8 }
</style>
