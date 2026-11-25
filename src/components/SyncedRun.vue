<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";

const props = defineProps({
  poses: { type: String, required: true },
  run: { type: String, required: true },
  video: { type: String, default: "" },
});

const data = ref(null);
const tick = ref(0);
const vid = ref(null);
const failed = ref(false);
const playing = ref(false);
let timer = null;

function toggle() {
  playing.value = !playing.value;
  clearInterval(timer);
  if (playing.value) {
    if (tick.value >= n.value - 1) tick.value = 0;
    timer = setInterval(() => {
      if (tick.value >= n.value - 1) {
        playing.value = false;
        clearInterval(timer);
      } else {
        tick.value = Math.min(tick.value + 5, n.value - 1);
      }
    }, 50);
  }
}
onBeforeUnmount(() => clearInterval(timer));

onMounted(async () => {
  try {
    const res = await fetch(props.poses);
    data.value = (await res.json());
  } catch (e) {
    failed.value = true;
  }
});

const r = computed(() => data.value && data.value.runs[props.run]);
const n = computed(() => (r.value ? r.value.frame.length : 0));
const dt = computed(() => (data.value ? data.value.dt : 0.1));

const W = 520, H = 150, PAD = 6;
const errMax = computed(() => (r.value ? Math.max(...r.value.err_m, 0.01) : 1));
const errPath = computed(() => {
  if (!r.value) return "";
  const m = errMax.value;
  return r.value.err_m
    .map((e, i) => `${i ? "L" : "M"}${PAD + (i / (n.value - 1)) * (W - 2 * PAD)},${H - PAD - (e / m) * (H - 2 * PAD)}`)
    .join("");
});
// optional r.fixes: [{i: index into frame, p: [x, y]}], drawn as beacons on the map and bars on the error plot
const fixes = computed(() => (r.value && r.value.fixes ? r.value.fixes : []));
function fixX(i) { return PAD + (i / Math.max(n.value - 1, 1)) * (W - 2 * PAD); }
// optional data.noise: {v: [...], w: [...]} measured minus clean speed and yaw rate per tick, shared by all runs
function noisePath(a) {
  const m = Math.max(...a.map(Math.abs), 1e-6);
  return a.map((e, i) => `${i ? "L" : "M"}${PAD + (i / (a.length - 1)) * (W - 2 * PAD)},${H2 / 2 - (e / m) * (H2 / 2 - 4)}`).join("");
}
const H2 = 60;
const noise = computed(() => {
  const nz = data.value && data.value.noise;
  if (!nz) return null;
  return [["speed noise", nz.v, "m/s"], ["yaw-rate noise", nz.w, "rad/s"]].map(([l, a, u]) => ({
    l, u, path: noisePath(a), cur: a[tick.value], max: Math.max(...a.map(Math.abs)),
  }));
});
const barX = computed(() => PAD + (tick.value / Math.max(n.value - 1, 1)) * (W - 2 * PAD));

const mat = computed(() => (r.value && r.value.mat ? r.value.mat[tick.value] : null));
function cell(v) {
  const l = Math.max(0, Math.min(v / 1.2, 1));
  return `hsl(28, 90%, ${8 + l * 52}%)`;
}
const MAT_LABELS = ["speed", "yaw rate"];

const S = 300;
const box = computed(() => {
  if (!r.value) return null;
  const pts = r.value.true.concat(r.value.est);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const sc = (S - 2 * PAD) / Math.max(x1 - x0, y1 - y0);
  return { x0, y1, sc };
});
function xy(p) {
  const b = box.value;
  return [PAD + (p[0] - b.x0) * b.sc, PAD + (b.y1 - p[1]) * b.sc];
}
function line(a, upto) {
  return a.slice(0, upto + 1).map((p, i) => `${i ? "L" : "M"}${xy(p).join(",")}`).join("");
}
const fullPath = computed(() => (r.value ? line(r.value.true, n.value - 1) : ""));
const truePath = computed(() => (r.value ? line(r.value.true, tick.value) : ""));
const estPath = computed(() => (r.value ? line(r.value.est, tick.value) : ""));
const headT = computed(() => (r.value ? xy(r.value.true[tick.value]) : [0, 0]));
const headE = computed(() => (r.value ? xy(r.value.est[tick.value]) : [0, 0]));

watch(tick, (t) => {
  if (vid.value && Number.isFinite(vid.value.duration)) {
    vid.value.currentTime = Math.min((t / Math.max(n.value - 1, 1)) * vid.value.duration, vid.value.duration);
  }
});
</script>

<template>
  <div class="sr">
    <div v-if="failed || (data && !r)" class="sr-msg">No data for {{ run }}.</div>
    <div v-else-if="!r" class="sr-msg">Loading {{ run }}…</div>
    <template v-else>
      <div class="sr-row">
        <video v-if="video" ref="vid" :src="video" preload="metadata" muted class="sr-video"></video>
        <svg :viewBox="`0 0 ${S} ${S}`" class="sr-map">
          <path :d="fullPath" class="full" />
          <path :d="truePath" class="t" />
          <path :d="estPath" class="e" />
          <g v-for="(f, k) in fixes" :key="'b' + k" :class="f.i <= tick ? 'bk on' : 'bk'">
            <path :d="`M${xy(f.p)[0]},${xy(f.p)[1] - 6}L${xy(f.p)[0] + 5},${xy(f.p)[1] + 4}L${xy(f.p)[0] - 5},${xy(f.p)[1] + 4}Z`" />
          </g>
          <circle :cx="headT[0]" :cy="headT[1]" r="4" class="t-dot" />
          <circle :cx="headE[0]" :cy="headE[1]" r="4" class="e-dot" />
        </svg>
        <svg v-if="mat" viewBox="0 0 150 150" class="sr-mat">
          <text x="75" y="12" class="lbl" text-anchor="middle">learned matrix</text>
          <g v-for="(v, i) in mat" :key="i">
            <rect :x="46 + (i % 2) * 48" :y="24 + Math.floor(i / 2) * 48" width="46" height="46" :fill="cell(v)" />
            <text :x="69 + (i % 2) * 48" :y="52 + Math.floor(i / 2) * 48" class="mv" text-anchor="middle">{{ v.toFixed(2) }}</text>
          </g>
          <text x="69" y="124" class="lbl" text-anchor="middle">{{ MAT_LABELS[0] }}</text>
          <text x="117" y="124" class="lbl" text-anchor="middle">{{ MAT_LABELS[1] }}</text>
          <text x="2" y="50" class="lbl">{{ MAT_LABELS[0] }}</text>
          <text x="2" y="98" class="lbl">{{ MAT_LABELS[1] }}</text>
          <text x="75" y="142" class="lbl" text-anchor="middle">true value 1 on the diagonal</text>
        </svg>
      </div>
      <svg :viewBox="`0 0 ${W} ${H}`" class="sr-err">
        <path :d="errPath" class="err" />
        <line v-for="(f, k) in fixes" :key="'f' + k" :x1="fixX(f.i)" :x2="fixX(f.i)" y1="0" :y2="H" :class="f.i <= tick ? 'fx on' : 'fx'" />
        <line :x1="barX" :x2="barX" y1="0" :y2="H" class="bar" />
        <text x="8" y="14" class="lbl">position error, max {{ errMax.toFixed(2) }} m</text>
      </svg>
      <svg v-for="z in noise || []" :key="z.l" :viewBox="`0 0 ${W} ${H2}`" class="sr-err">
        <path :d="z.path" class="nz" />
        <line :x1="barX" :x2="barX" y1="0" :y2="H2" class="bar" />
        <text x="8" y="12" class="lbl">{{ z.l }}, now {{ z.cur.toFixed(3) }} {{ z.u }}, max {{ z.max.toFixed(3) }}</text>
      </svg>
      <div class="sr-ctl"><button class="sr-play" @click="toggle">{{ playing ? "Pause" : "Play" }}</button>
      <input type="range" min="0" :max="n - 1" v-model.number="tick" class="sr-slider" /></div>
      <div class="sr-info">
        tick {{ tick }} of {{ n - 1 }} ({{ (tick * dt).toFixed(1) }} s), error {{ r.err_m[tick].toFixed(3) }} m
        <span v-if="fixes.length" class="fx-key">▲ position fix</span>
        <span class="t-key">ground truth</span> <span class="e-key">estimate</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.sr { background: #14161a; border-radius: 8px; padding: 10px; margin: 6px 0; min-width: 0; }
.sr-row { display: flex; flex-wrap: wrap; gap: 8px; }
.sr-video { width: 100%; border-radius: 6px; }
.sr-map { flex: 1 1 240px; min-width: 240px; max-height: 260px; background: #0c0d10; border-radius: 6px; }
.sr-mat { flex: 0 1 170px; min-width: 150px; background: #0c0d10; border-radius: 6px; }
.mv { fill: #fff; font-size: 12px; font-weight: 600; }
.sr-err { width: 100%; background: #0c0d10; border-radius: 6px; margin-top: 8px; }
.t, .e, .err { fill: none; stroke-width: 1.5; }
.full { fill: none; stroke: #2a2f38; stroke-width: 3; }
.t { stroke: #7a8aa0; }
.e { stroke: #ff9f43; }
.err { stroke: #4da3ff; }
.t-dot { fill: #7a8aa0; }
.e-dot { fill: #ff9f43; }
.bk path { fill: none; stroke: #5b6573; stroke-width: 1.2; }
.bk.on path { fill: #34d399; stroke: #34d399; }
.fx { stroke: #2f3a36; stroke-width: 1; }
.fx.on { stroke: #34d399; stroke-width: 1.2; }
.nz { fill: none; stroke: #a78bfa; stroke-width: 0.8; }
.bar { stroke: #e6e6e6; stroke-width: 1; }
.lbl { fill: #9aa3ad; font-size: 9px; }
.sr-ctl { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
.sr-play { background: #2a2f38; color: #e6e6e6; border: 0; border-radius: 4px; padding: 3px 10px; cursor: pointer; }
.sr-slider { flex: 1; }
.sr-info, .sr-msg { color: #c9d1d9; font-size: 13px; margin-top: 4px; }
.fx-key { color: #34d399; margin-left: 10px; }
.t-key { color: #7a8aa0; margin-left: 10px; }
.e-key { color: #ff9f43; margin-left: 6px; }
</style>
