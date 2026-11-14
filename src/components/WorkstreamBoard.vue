<script setup>
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'

// Live board of workstreams/*.md, grouped by status. Reads the same data as the status chips, so it
// follows file edits without regenerating a page.
const { theme } = useData()
const ORDER = ['active', 'queued', 'proposed', 'blocked', 'done', 'declined']
const groups = computed(() => {
  const items = Object.entries(theme.value.workstreams || {}).map(([id, w]) => ({ id, ...w }))
  const names = [...ORDER, ...new Set(items.map(i => i.status).filter(s => !ORDER.includes(s)))]
  return names.map(name => ({ name, rows: items.filter(i => i.status === name).sort((a, b) => a.id.localeCompare(b.id)) })).filter(g => g.rows.length)
})
const link = id => withBase(`/workstreams/${id}`)
</script>

<template>
  <div class="wsb">
    <p v-if="!groups.length">No workstreams yet.</p>
    <section v-for="g in groups" :key="g.name">
      <h2>{{ g.name }} <small>({{ g.rows.length }})</small></h2>
      <table>
        <thead><tr><th>Request</th><th>Owner</th><th>Steps</th><th>Depends on</th><th>Summary</th></tr></thead>
        <tbody>
          <tr v-for="r in g.rows" :key="r.id">
            <td><a :href="link(r.id)">{{ r.title }}</a></td>
            <td>{{ r.owner }}</td>
            <td>{{ r.total ? `${r.done}/${r.total}` : '' }}</td>
            <td><template v-for="(d, n) in r.depends_on" :key="d"><span v-if="n">, </span><a :href="link(d)">{{ d }}</a></template></td>
            <td>{{ r.summary }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style>
.wsb h2 small { color: var(--vp-c-text-3); font-weight: 400 }
.wsb table { display: table; width: 100% }
.wsb th, .wsb td { padding: 6px 8px; font-size: 13px; vertical-align: top }
</style>
