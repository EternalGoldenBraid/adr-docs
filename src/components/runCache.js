// Browser-side copies of finished catalog runs, bounded by page history. A finished run never changes, so its
// scalars are kept after the first fetch and plots draw without the ssh tunnel. The newest KEEP pages
// are the history; a run no page in the history references is dropped.
const KEEP = 20
const DB = "adr-runs"

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore("runs")
      req.result.createObjectStore("pages")
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

const done = tx => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve()
  tx.onerror = tx.onabort = () => reject(tx.error)
})
const get = (store, key) => new Promise((resolve, reject) => {
  const r = store.get(key)
  r.onsuccess = () => resolve(r.result)
  r.onerror = () => reject(r.error)
})
const all = store => new Promise((resolve, reject) => {
  const r = store.openCursor()
  const out = []
  r.onsuccess = () => {
    const c = r.result
    if (c) { out.push([c.key, c.value]); c.continue() } else resolve(out)
  }
  r.onerror = () => reject(r.error)
})

async function reference(db, page, src) {
  const tx = db.transaction("pages", "readwrite")
  const prev = (await get(tx.objectStore("pages"), page)) ?? { srcs: [] }
  tx.objectStore("pages").put({ srcs: [...new Set([...prev.srcs, src])], at: Date.now() }, page)
  await done(tx)
}

async function trim(db) {
  const pages = (await all(db.transaction("pages").objectStore("pages"))).sort((a, b) => b[1].at - a[1].at)
  const tx = db.transaction(["pages", "runs"], "readwrite")
  for (const [page] of pages.slice(KEEP)) tx.objectStore("pages").delete(page)
  const kept = new Set(pages.slice(0, KEEP).flatMap(([, p]) => p.srcs))
  const runs = tx.objectStore("runs")
  const keys = await new Promise(resolve => {
    const r = runs.getAllKeys()
    r.onsuccess = () => resolve(r.result)
  })
  for (const k of keys) if (!kept.has(k)) runs.delete(k)
  await done(tx)
}

// Every call resolves; a missing or blocked IndexedDB only means no local copy.
export async function cachedRun(page, src) {
  try {
    const db = await open()
    const text = await get(db.transaction("runs").objectStore("runs"), src)
    if (text !== undefined) await reference(db, page, src)
    return text
  } catch { return undefined }
}

export async function storeRun(page, src, text) {
  try {
    const db = await open()
    const tx = db.transaction("runs", "readwrite")
    tx.objectStore("runs").put(text, src)
    await done(tx)
    await reference(db, page, src)
    await trim(db)
  } catch { /* no local copy */ }
}
