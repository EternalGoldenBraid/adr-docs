<script setup>
import { computed, ref } from 'vue'
import { useData, withBase } from 'vitepress'

// Live board of workstreams/*.md, grouped by status. Reads the same data as the status chips, so it
// follows file edits without regenerating a page. `priority:` (lower first) orders rows within a status;
// chips filter by owner and by `machine:`.
const { theme } = useData()
const ORDER = ['active', 'queued', 'proposed', 'blocked', 'done', 'declined']
const items = computed(() => Object.entries(theme.value.workstreams || {}).map(([id, w]) => ({ id, ...w })))
const ownerNames = owner => (owner || '').replace(/\([^)]*\)/g, '').split(',').map(name => name.trim()).filter(Boolean)
const owners = computed(() => [...new Set(items.value.flatMap(i => ownerNames(i.owner)))].sort())
const machines = computed(() => [...new Set(items.value.map(i => i.machine).filter(Boolean))].sort())
const owner = ref('')
const machine = ref('')
const matches = i => (!owner.value || ownerNames(i.owner).includes(owner.value)) && (!machine.value || i.machine === machine.value)
const groups = computed(() => {
  const names = [...ORDER, ...new Set(items.value.map(i => i.status).filter(s => !ORDER.includes(s)))]
  const rank = i => i.priority ?? Infinity
  return names.map(name => ({ name, rows: items.value.filter(i => i.status === name && matches(i)).sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id)) })).filter(g => g.rows.length)
})
const link = id => withBase(`/workstreams/${id}`)
</script>

<template>
  <div class="wsb">
    <p v-if="owners.length > 1 || machines.length" class="wsb-chips">
      <button v-for="name in owners" :key="'o' + name" :class="{ on: owner === name }" @click="owner = owner === name ? '' : name">{{ name }}</button>
      <button v-for="name in machines" :key="'m' + name" :class="{ on: machine === name }" @click="machine = machine === name ? '' : name">@{{ name }}</button>
    </p>
    <p v-if="!groups.length">No workstreams{{ owner || machine ? ' match' : ' yet' }}.</p>
    <section v-for="g in groups" :key="g.name">
      <h2>{{ g.name }} <small>({{ g.rows.length }})</small></h2>
      <table>
        <thead><tr><th v-if="g.name === 'queued'">#</th><th>Request</th><th>Owner</th><th>Steps</th><th>Depends on</th><th>Summary</th></tr></thead>
        <tbody>
          <tr v-for="(r, n) in g.rows" :key="r.id">
            <td v-if="g.name === 'queued'">{{ n + 1 }}</td>
            <td><a :href="link(r.id)">{{ r.title }}</a></td>
            <td>{{ r.owner }}<small v-if="r.machine"> @{{ r.machine }}</small></td>
            <td>{{ r.total ? `${r.done}/${r.total}` : '' }}</td>
            <td><template v-for="(d, k) in r.depends_on" :key="d"><span v-if="k">, </span><a :href="link(d)">{{ d }}</a></template></td>
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
.wsb-chips { display: flex; flex-wrap: wrap; gap: 6px }
.wsb-chips button { border: 1px solid var(--vp-c-divider); background: var(--vp-c-bg-soft); border-radius: 999px; padding: 2px 10px; font-size: 12px; cursor: pointer; color: var(--vp-c-text-2) }
.wsb-chips button.on { border-color: var(--vp-c-brand-1); color: var(--vp-c-text-1) }
</style>
