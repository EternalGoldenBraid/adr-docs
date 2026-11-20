<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'

// <SplatViewer src="/data/splat/car0/car.ply" /> shows a Gaussian splat (.ply, .splat, .spz, .ksplat) you can orbit.
// The viewer library ships with the plugin and loads only when a page uses this component; nothing is fetched from outside.
const props = defineProps({
  src: { type: String, required: true },
  height: { type: [String, Number], default: 480 },
  position: { type: Array, default: () => [0, 0, 5] },
  target: { type: Array, default: () => [0, 0, 0] },
  up: { type: Array, default: () => [0, 1, 0] },
  rotate: { type: Boolean, default: false },
})
const host = ref(null)
const state = ref('loading')
let dispose = () => {}

const h = computed(() => typeof props.height === 'number' ? `${props.height}px` : props.height)

onMounted(async () => {
  try {
    const THREE = await import('three')
    const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')
    const { SparkRenderer, SplatMesh } = await import('@sparkjsdev/spark')
    const el = host.value
    const renderer = new THREE.WebGLRenderer({ antialias: false })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    el.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 1000)
    camera.up.set(...props.up)
    camera.position.set(...props.position)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(...props.target)
    controls.autoRotate = props.rotate
    controls.enableDamping = true
    controls.update()
    const spark = new SparkRenderer({ renderer })
    scene.add(spark)
    const splat = new SplatMesh({ url: new URL(props.src, location.href).href })
    scene.add(splat)
    await splat.initialized
    const fit = () => {
      const w = el.clientWidth || 640
      const hh = el.clientHeight || 480
      renderer.setSize(w, hh)
      camera.aspect = w / hh
      camera.updateProjectionMatrix()
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera) })
    state.value = 'ready'
    el.dataset.splats = String(splat.numSplats ?? '')
    dispose = () => { ro.disconnect(); renderer.setAnimationLoop(null); splat.dispose?.(); renderer.dispose(); renderer.domElement.remove() }
  } catch (error) {
    state.value = error?.message?.includes('WebGL') ? 'WebGL is not available in this browser.' : `Could not load ${props.src}: ${error?.message || error}`
  }
})
onBeforeUnmount(() => dispose())
</script>

<template>
  <div class="splat-viewer" :style="{ height: h }">
    <div ref="host" class="splat-host"></div>
    <div v-if="state !== 'ready'" class="splat-note">{{ state === 'loading' ? 'Loading splat…' : state }}</div>
  </div>
</template>

<style scoped>
.splat-viewer { position: relative; width: 100%; margin: 16px 0; border: 1px solid var(--vp-c-divider); border-radius: 8px; overflow: hidden; background: #0d1117 }
.splat-host { position: absolute; inset: 0 }
.splat-host :deep(canvas) { width: 100%; height: 100%; display: block }
.splat-note { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 16px; color: #9aa4b2; font-size: 14px; text-align: center }
</style>
