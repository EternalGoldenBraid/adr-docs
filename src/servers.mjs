// Running ADR servers, found through the connection.json each comment bridge writes into its store.
import { spawn } from "node:child_process";
import { appendFileSync } from "node:fs";
import { mkdirSync, openSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const LAUNCHER = fileURLToPath(new URL("../bin/preview.mjs", import.meta.url));

// Ports Chrome and Firefox refuse to open (ERR_UNSAFE_PORT), so a server there looks dead.
const BLOCKED = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79, 87, 95, 101, 102, 103, 104, 109, 110,
  111, 113, 115, 117, 119, 123, 135, 137, 139, 143, 161, 179, 389, 427, 465, 512, 513, 514, 515, 526, 530, 531, 532,
  540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993, 995, 1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061,
  6000, 6566, 6665, 6666, 6667, 6668, 6669, 6679, 6697, 10080,
]);
export const isBlockedPort = port => BLOCKED.has(Number(port));

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === "EPERM"; }
}

const keptStores = storageRoot => new Set(readHistory(storageRoot).filter(row => row.keep).map(row => row.store));

// Servers whose process is gone leave a stale connection.json; `prune` removes it.
export function listServers(storageRoot, { prune = false } = {}) {
  const rows = [];
  let stores = [];
  try { stores = readdirSync(storageRoot); } catch { return rows; }
  for (const store of stores) {
    const file = join(storageRoot, store, "connection.json");
    let info;
    try { info = JSON.parse(readFileSync(file, "utf8")); } catch { continue; }
    if (!info.pid) continue; // written by an older version, cannot tell if it is running
    if (!alive(info.pid)) {
      if (prune) try { unlinkSync(file); } catch { /* already gone */ }
      continue;
    }
    rows.push({ store, url: info.previewOrigin, pid: info.pid, root: info.documentRoot, startedAt: info.startedAt, name: info.name, standalone: isStandalone(info.pid), kept: keptStores(storageRoot).has(store) });
  }
  return rows.sort((a, b) => String(a.url).localeCompare(String(b.url)));
}

// Only servers started with `adr` may be stopped or restarted from here; an agent session's server shares its process.
export function isStandalone(pid) {
  try { return readFileSync(`/proc/${pid}/cmdline`, "utf8").includes("preview.mjs"); } catch { return false; }
}

// A server's address: NAME.localhost resolves to this machine in browsers, so the name replaces 127.0.0.1.
export const displayUrl = row => row.name ? row.url.replace("127.0.0.1", `${row.name}.localhost`) : row.url;

const historyFile = storageRoot => join(storageRoot, "history.json");
export function readHistory(storageRoot) {
  try { return JSON.parse(readFileSync(historyFile(storageRoot), "utf8")); } catch { return []; }
}
// What `adr` was asked to serve, newest first, so a stopped server can be started again.
export function recordLaunch(storageRoot, entry) {
  const keep = readHistory(storageRoot).find(row => row.store === entry.store)?.keep;
  const rows = [{ ...entry, ...(keep ? { keep } : {}), at: new Date().toISOString() }, ...readHistory(storageRoot).filter(row => row.store !== entry.store)].slice(0, 30);
  mkdirSync(storageRoot, { recursive: true });
  writeFileSync(historyFile(storageRoot), JSON.stringify(rows, null, 1));
}

// Persistent servers: the daemon (and any agent that finds one down) starts them again.
export function setKeep(storageRoot, store, keep) {
  const rows = readHistory(storageRoot);
  const row = rows.find(entry => entry.store === store);
  if (!row) return false;
  if (keep) row.keep = true; else delete row.keep;
  writeFileSync(historyFile(storageRoot), JSON.stringify(rows, null, 1));
  return true;
}

// Starts every kept server that is not running. Returns the stores it started.
export function startKept(storageRoot) {
  const running = new Set(listServers(storageRoot).map(row => row.store));
  const started = [];
  for (const entry of readHistory(storageRoot)) {
    if (!entry.keep || running.has(entry.store)) continue;
    startDetached(storageRoot, launchArgs(entry));
    started.push(entry.store);
  }
  return started;
}

// Wake-on-demand: if `store` is a kept server that is down, start it and wait until it answers.
export async function ensureServer(storageRoot, store, ms = 20000) {
  if (listServers(storageRoot).some(row => row.store === store)) return true;
  const entry = readHistory(storageRoot).find(row => row.store === store && row.keep);
  if (!entry) return false;
  startDetached(storageRoot, launchArgs(entry));
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (listServers(storageRoot).some(row => row.store === store)) return true;
    await new Promise(done => setTimeout(done, 300));
  }
  return false;
}

export function launchArgs(entry) {
  return [entry.document, "--port", String(entry.port), "--store", entry.store, ...(entry.name ? ["--name", entry.name] : [])];
}

export function startDetached(storageRoot, argv, env = {}) {
  mkdirSync(storageRoot, { recursive: true });
  const store = argv[argv.indexOf("--store") + 1] ?? "adr";
  const log = openSync(join(storageRoot, `${store}.log`), "a");
  const child = spawn(process.execPath, [LAUNCHER, ...argv.filter(arg => arg !== "-d" && arg !== "--detach")], {
    detached: true, stdio: ["ignore", log, log], env: { ...process.env, ADR_SUPERVISE: "1", ...env },
  });
  child.unref();
  return child;
}

export async function waitForExit(pid, ms = 10000) {
  const end = Date.now() + ms;
  while (Date.now() < end && alive(pid)) await new Promise(done => setTimeout(done, 100));
  return !alive(pid);
}

// Why a server stopped: written to <store>/exit.json and appended to <store>.log so a silent death can be explained.
export function recordExit(storageRoot, store, reason) {
  const entry = { at: new Date().toISOString(), pid: process.pid, reason };
  try {
    mkdirSync(join(storageRoot, store), { recursive: true });
    writeFileSync(join(storageRoot, store, "exit.json"), JSON.stringify(entry));
    appendFileSync(join(storageRoot, `${store}.log`), `${entry.at} pid ${entry.pid} exit: ${reason}\n`);
  } catch { /* the process is ending anyway */ }
}

// Servers that stopped within `hours` and are not running now, with the recorded reason.
export function listDeadServers(storageRoot, hours = 48) {
  const running = new Set(listServers(storageRoot).map(row => row.store));
  const rows = [];
  let stores = [];
  try { stores = readdirSync(storageRoot); } catch { return rows; }
  for (const store of stores) {
    if (running.has(store)) continue;
    try {
      const exit = JSON.parse(readFileSync(join(storageRoot, store, "exit.json"), "utf8"));
      if (Date.now() - Date.parse(exit.at) < hours * 3600e3) rows.push({ store, ...exit });
    } catch { /* never recorded */ }
  }
  return rows.sort((a, b) => b.at.localeCompare(a.at));
}
