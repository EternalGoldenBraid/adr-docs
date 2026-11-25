<script setup>
// Interactive figure from Plotly JSON ({data, layout}), e.g. written by tools/figures/plotly_fig.py.
// Colours of text, grid and background follow the page theme; the figure's own layout wins where it sets them.
// live: re-fetch every `live` seconds and redraw when the file changed (plots a running job rewrites, e.g. through
// a job's results node).
// A `.jsonl` src is a run's scalars from the catalog (one JSON message per line): every numeric field gets its own
// panel against t, the seconds since the run started; progress messages are skipped.
// Options for that mode: `fields` picks the panels, `x` the field on the x axis. `xy` draws a map instead: one path
// per [x, y] or [x, y, label] field pair, with a marker at the latest point; `colorBy` (a field such as err_m) shades the
// estimated path by that field instead. `runs` fills `{run}` in src with each name (e.g. seeds);
// panels then show the mean over runs with a ±1 std band, matched by x value, and the map one thin path per run.
// `overlay`: the runs are arms to compare, not seeds; each panel draws one line per run, named by the run
// (`labels`, `colors` and `dashes` set a legend name, colour and line style per run).
// A `<Video>` of the same run sends its playback position (`run-tick`, run and fraction of the video); every panel
// of that run draws a vertical cursor at that fraction of its x range, so video and plots read on one tick.
import { onBeforeUnmount, onMounted, ref } from "vue"
import { withBase } from "vitepress"
import { cachedRun, storeRun } from "./runCache.js"

import fieldNames from "./fieldNames.json"

const props = defineProps({
  src: { type: String, required: true },
  height: { type: Number, default: 420 },
  live: { type: Number, default: 0 },
  // "gl3d" loads the bundle with scatter3d (needed for 3D figures); figures with `frames` are animated.
  bundle: { type: String, default: "basic" },
  fields: { type: Array, default: null },
  // readable names per field, over the shared ones in fieldNames.json: { map_w: "Mean map weight" }
  names: { type: Object, default: null },
  x: { type: String, default: "t" },
  xy: { type: Array, default: null },
  // with `xy`: colour the estimated path by this field of each tick (for example err_m)
  colorBy: { type: String, default: null },
  runs: { type: Array, default: null },
  overlay: { type: Boolean, default: false },
  // with `overlay`, one entry per run: the legend name, the line colour (any CSS colour) and the Plotly dash style
  // ("solid", "dash", "dot", ...); colour can mark the condition and dash the method.
  labels: { type: Array, default: null },
  colors: { type: Array, default: null },
  dashes: { type: Array, default: null },
})

const el = ref(null)
const error = ref("")
let fig = null
let observer = null
let timer = null
let stopped = false
let last = null

// The published site has no catalog: a catalog file is read from the exported copy under /data/runs.
const CATALOG = "http://127.0.0.1:8766/runs/"
async function fetchFile(src) {
  try {
    const r = await fetch(withBase(src), { cache: "no-store" })
    if (r.ok || !src.startsWith(CATALOG)) return r
  } catch (e) { if (!src.startsWith(CATALOG)) throw e }
  const copy = await fetch(withBase(src.replace(CATALOG, "/data/runs/")))
  copy.exported = copy.ok
  return copy
}

async function fetchText(src, jsonl) {
  const r = await fetchFile(src)
  if (r.exported) exported.add(src)
  // a declared run that has not reported yet: draw the empty figure and keep polling
  if (!r.ok && !(jsonl && r.status === 404)) throw new Error(`${r.status} ${src}`)
  return r.ok ? await r.text() : ""
}

// A catalog run's file is fetched again only while its manifest says the run is still going; a finished
// or failed run is fetched once and the polling stops (the files are ~1 MB each, over an ssh tunnel).
const finished = new Set()
const exported = new Set()
const cache = {}
async function fetchRun(src) {
  const m = src.match(/^(.*\/runs\/[^/]+\/[^/]+)\/[^/]+\.jsonl$/)
  if (m && finished.has(src)) return cache[src]
  // a finished run kept in this browser from an earlier visit: no catalog request, so no tunnel needed
  const kept = m ? await cachedRun(location.pathname, src) : undefined
  if (kept !== undefined) {
    cache[src] = kept
    finished.add(src)
    return kept
  }
  // read the phase before the file, so a run seen as finished has its complete file
  let over = false
  if (m) {
    try {
      const r = await fetch(withBase(m[1]), { cache: "no-store" })
      over = r.ok && ["done", "failed"].includes((await r.json()).progress?.phase)
    } catch { /* keep polling */ }
  }
  const text = await fetchText(src, true)
  if (m) cache[src] = text
  if (exported.has(src)) finished.add(src)
  if (over) {
    finished.add(src)
    storeRun(location.pathname, src, text)
  }
  return text
}

async function load() {
  const jsonl = props.src.endsWith(".jsonl")
  const srcs = jsonl && props.runs ? props.runs.map(run => props.src.replaceAll("{run}", run)) : [props.src]
  const texts = await Promise.all(srcs.map(s => jsonl ? fetchRun(s) : fetchText(s, false)))
  if (jsonl && srcs.every(s => finished.has(s))) stopPolling()
  const key = texts.join("\u0000")
  if (key === last) return
  last = key
  if (!jsonl) fig = JSON.parse(texts[0])
  else {
    const runs = texts.map(t => t.split("\n").filter(Boolean).map(l => JSON.parse(l)).filter(r => r.kind !== "progress"))
    fig = props.xy ? mapFigure(runs) : scalarsFigure(runs)
  }
  await draw()
}

const waiting = xtitle => ({ data: [], layout: { xaxis: { title: xtitle },
  annotations: [{ text: "Waiting for data", showarrow: false, xref: "paper", yref: "paper", x: 0.5, y: 0.5 }] } })

const nice = k => props.names?.[k] ?? fieldNames[k] ?? k

function scalarsFigure(runs) {
  const rows = runs.flat()
  const xk = props.x, skip = new Set(["t", "seq", xk])
  const keys = props.fields ?? [...new Set(rows.flatMap(r => Object.keys(r).filter(k => !skip.has(k) && typeof r[k] === "number")))]
  const xtitle = xk === "t" ? "t (s)" : xk
  if (!rows.length || !keys.length) return waiting(xtitle)
  const layout = { grid: { rows: keys.length, columns: 1, pattern: "coupled" }, showlegend: props.overlay,
    height: Math.max(props.height, 150 * keys.length), xaxis: { title: xtitle } }
  const data = keys.flatMap((k, i) => {
    const yaxis = `y${i ? i + 1 : ""}`
    layout[`yaxis${i ? i + 1 : ""}`] = { title: nice(k) }
    if (props.overlay && runs.length > 1) {
      return runs.map((rs, j) => {
        const has = rs.filter(r => typeof r[k] === "number" && typeof r[xk] === "number")
        const name = props.labels?.[j] ?? props.runs[j]
        return { x: has.map(r => r[xk]), y: has.map(r => r[k]), type: "scatter", mode: "lines", name,
          legendgroup: name, showlegend: i === 0,
          line: { color: props.colors?.[j] ?? palette[j % palette.length], dash: props.dashes?.[j] ?? "solid" }, yaxis }
      })
    }
    if (runs.length === 1) {
      const has = rows.filter(r => typeof r[k] === "number")
      return [{ x: has.map(r => r[xk]), y: has.map(r => r[k]), type: "scatter", mode: "lines", name: nice(k), yaxis }]
    }
    // mean and std over the runs that have a value at each x
    const byX = new Map()
    for (const r of rows) if (typeof r[k] === "number" && typeof r[xk] === "number") byX.set(r[xk], [...(byX.get(r[xk]) ?? []), r[k]])
    const xs = [...byX.keys()].sort((a, b) => a - b)
    const mean = xs.map(x => byX.get(x).reduce((s, v) => s + v, 0) / byX.get(x).length)
    const std = xs.map((x, j) => Math.sqrt(byX.get(x).reduce((s, v) => s + (v - mean[j]) ** 2, 0) / byX.get(x).length))
    return [
      { x: [...xs, ...xs.slice().reverse()], y: [...mean.map((m, j) => m + std[j]), ...mean.map((m, j) => m - std[j]).reverse()],
        type: "scatter", mode: "lines", fill: "toself", line: { width: 0 }, fillcolor: "rgba(99,110,250,0.25)", hoverinfo: "skip", yaxis },
      { x: xs, y: mean, type: "scatter", mode: "lines", name: `${nice(k)}, mean of ${runs.length}`, line: { color: "#636efa" }, yaxis },
    ]
  })
  return { data, layout }
}

const palette = ["#00cc96", "#ef553b", "#ab63fa", "#ffa15a", "#19d3f3"]
function mapFigure(runs) {
  const multi = runs.length > 1
  const data = []
  props.xy.forEach(([xk, yk, label], i) => {
    // the same truth in every run: draw it once, from the first run
    const shown = multi && /true/.test(xk) ? runs.slice(0, 1) : runs
    shown.forEach((rows, j) => {
      const has = rows.filter(r => typeof r[xk] === "number" && typeof r[yk] === "number")
      if (!has.length) return
      const color = palette[i % palette.length]
      const name = multi && shown.length > 1 ? `${label ?? xk}, ${props.runs[j]}` : label ?? xk
      const shaded = props.colorBy && !/true/.test(xk) && has.every(r => typeof r[props.colorBy] === "number")
      data.push(shaded
        ? { x: has.map(r => r[xk]), y: has.map(r => r[yk]), type: "scatter", mode: "markers", name,
            marker: { size: 4, color: has.map(r => r[props.colorBy]), colorscale: "Viridis", showscale: j === 0, colorbar: { title: props.colorBy } },
            hoverinfo: "x+y+text", text: has.map(r => `${props.colorBy} ${r[props.colorBy].toFixed(3)}`) }
        : { x: has.map(r => r[xk]), y: has.map(r => r[yk]), type: "scatter", mode: "lines", name,
            line: { color, width: shown.length > 1 ? 1 : 2 }, opacity: shown.length > 1 ? 0.6 : 1 })
      const end = has[has.length - 1]
      data.push({ x: [end[xk]], y: [end[yk]], type: "scatter", mode: "markers", marker: { color, size: 9 }, showlegend: false, hoverinfo: "skip" })
    })
  })
  const [xk0, yk0] = props.xy[0]
  if (!data.length) return waiting(xk0)
  return { data, layout: { xaxis: { title: xk0, constrain: "domain" }, yaxis: { title: yk0, scaleanchor: "x", constrain: "domain" }, legend: { orientation: "h" } } }
}

// The bundle is UMD; run it as CommonJS so it does not leave a stray global behind.
const bundles = {}
let plotly = null
function loadPlotly() {
  const name = props.bundle
  bundles[name] ??= fetch(withBase(`/data/vendor/plotly-${name}-4.3.0.min.js`))
    .then(r => r.text())
    .then(src => {
      const module = { exports: {} }
      new Function("module", "exports", src)(module, module.exports)
      return module.exports
    })
  plotly = bundles[name]
  return plotly
}

function themeLayout() {
  const css = getComputedStyle(document.documentElement)
  const v = (name, fallback) => css.getPropertyValue(name).trim() || fallback
  const fg = v("--vp-c-text-1", "#dfdfd6"), dim = v("--vp-c-text-3", "#6a6a71"), grid = v("--vp-c-divider", "#2e2e32")
  const axis = { color: fg, gridcolor: grid, zerolinecolor: dim, linecolor: dim }
  return {
    paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: fg, family: v("--vp-font-family-base", "sans-serif"), size: 13 },
    xaxis: axis, yaxis: axis, xaxis2: axis, yaxis2: axis,
    legend: { bgcolor: "rgba(0,0,0,0)" },
    hoverlabel: { font: { family: "monospace" } },
    margin: { l: 60, r: 20, t: 40, b: 50 },
  }
}

const isObj = x => x && typeof x === "object" && !Array.isArray(x)
function merge(base, over) {
  const out = { ...base }
  for (const [k, x] of Object.entries(over ?? {})) out[k] = isObj(x) && isObj(base[k]) ? merge(base[k], x) : x
  return out
}

async function draw() {
  if (!fig || !el.value) return
  const Plotly = await loadPlotly()
  const layout = merge(merge(themeLayout(), { height: props.height }), fig.layout)
  // This Plotly version ignores a plain string axis title; it needs {text}.
  for (const [k, ax] of Object.entries(layout)) {
    if (!/^[xy]axis\d*$/.test(k)) continue
    layout[k] = merge(themeLayout().xaxis, ax)
    if (typeof ax?.title === "string") layout[k].title = { text: ax.title }
  }
  // Long y titles wrap at word boundaries so stacked panels do not overlap each other.
  let wrapped = false
  for (const [k, ax] of Object.entries(layout)) {
    const text = ax?.title?.text
    if (!/^yaxis\d*$/.test(k) || typeof text !== "string" || text.length <= 12 || text.includes("<br>")) continue
    ax.title.text = text.split(" ").reduce((ls, w) => (ls.length && ls[ls.length - 1].length + w.length < 12 ? (ls[ls.length - 1] += " " + w, ls) : (ls.push(w), ls)), []).join("<br>")
    ax.title.font = { ...ax.title.font, size: 11 }
    wrapped = true
  }
  if (wrapped) layout.margin = { ...layout.margin, l: Math.max(layout.margin?.l ?? 0, 100) }
  const config = { responsive: true, displaylogo: false }
  if (fig.frames?.length) {
    await Plotly.newPlot(el.value, fig.data, layout, config)
    await Plotly.addFrames(el.value, fig.frames)
  } else await Plotly.react(el.value, fig.data, layout, config)
}

function onTick(e) {
  const { run, frac } = e.detail
  const mine = props.src.includes(`/${run}/`) || (props.runs ?? []).includes(run)
  if (!mine || !fig?.data?.length || !el.value || !plotly) return
  const xs = fig.data.flatMap(t => (t.x ?? []).filter(v => typeof v === "number"))
  if (!xs.length) return
  const lo = Math.min(...xs), hi = Math.max(...xs), at = lo + frac * (hi - lo)
  const axes = Object.keys(el.value._fullLayout ?? {}).filter(k => /^xaxis\d*$/.test(k))
  const shapes = (axes.length ? axes : ["xaxis"]).map(a => ({
    type: "line", xref: "x" + a.slice(5), yref: "paper", x0: at, x1: at, y0: 0, y1: 1, line: { color: "#e6e6e6", width: 1 },
  }))
  plotly.then(P => P.relayout(el.value, { shapes }))
}

onMounted(async () => {
  window.addEventListener("run-tick", onTick)
  observer = new MutationObserver(draw)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
  try {
    await load()
  } catch (e) {
    error.value = String(e)
  }
  if (props.live > 0 && !stopped) {
    let busy = false
    timer = setInterval(async () => {
      if (busy) return
      busy = true
      try {
        await load()
        error.value = ""
      } catch (e) {
        error.value = String(e)
      } finally {
        busy = false
      }
    }, props.live * 1000)
  }
})

function stopPolling() {
  stopped = true
  clearInterval(timer)
}

onBeforeUnmount(async () => {
  window.removeEventListener("run-tick", onTick)
  observer?.disconnect()
  clearInterval(timer)
  if (el.value && plotly) (await plotly).purge(el.value)
})
</script>

<template>
  <div class="run-plot">
    <div ref="el" :style="{ minHeight: height + 'px' }" />
    <p v-if="error" class="run-plot-error">Plot failed to load: {{ error }}</p>
  </div>
</template>

<style scoped>
.run-plot { margin: 16px 0; }
.run-plot-error { color: var(--vp-c-danger-1); font-size: 0.9em; }
</style>
